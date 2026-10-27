import { assert, type TestSuite } from './assert';
import {
    GraphEvaluator, SCRIPT_NODE_TEMPLATE, addNode, canConnect, collapseToSubgraph, compileNodeScript, connect, createGraph,
    createNodeRegistry, defineNode, expandSubgraph, getNode, normalizeGraph, registerSubgraphs, removeNode, type ModuleKind,
} from '../graph';

function setup() {
    const nodes = createNodeRegistry();
    const graph = createGraph();
    const ev = new GraphEvaluator(nodes);
    const add = (type: string, values: Record<string, unknown> = {}) => addNode(graph, nodes.get(type)!, [0, 0], values);
    const link = (a: { id: string }, out: string, b: { id: string }, inp: string) => connect(graph, nodes, { node: a.id, port: out }, { node: b.id, port: inp });
    return { nodes, graph, ev, add, link };
}

export const graphTests: TestSuite = {
    'graph: defineNode parses ports; [] marks list ports; names must be unique'() {
        const def = defineNode({ type: 'a/b', inputs: { p: 'vec2[]', q: { type: 'number', default: 2 } }, outputs: { o: 'number' }, run: () => ({}) });
        assert.equal(def.title, 'b');
        assert.equal(def.category, 'a');
        assert.deepEqual(def.inputs.map((p) => [p.name, p.base, p.list]), [['p', 'vec2', true], ['q', 'number', false]]);
        let threw = false;
        try { defineNode({ type: 'x', inputs: { a: 'number' }, params: { a: { type: 'number' } }, run: () => ({}) }); } catch { threw = true; }
        assert.ok(threw);
    },

    'graph: addNode fills defaults; connect checks types and loops, replaces an input’s link'() {
        const { nodes, graph, add, link } = setup();
        const a = add('value/number', { value: 3 });
        const b = add('math/math');
        const c = add('value/color');
        assert.equal(b.values.a, 0);
        link(a, 'value', b, 'a');
        assert.ok(!canConnect(graph, nodes, { node: c.id, port: 'color' }, { node: b.id, port: 'b' }).ok); // color → number
        const b2 = add('math/math');
        link(b, 'result', b2, 'a');
        const loop = canConnect(graph, nodes, { node: b2.id, port: 'result' }, { node: b.id, port: 'b' });
        assert.ok(!loop.ok && /loop/.test((loop as any).reason));
        link(a, 'value', b2, 'a'); // replaces b → b2.a
        assert.equal(graph.links.filter((l) => l.to.node === b2.id).length, 1);
        removeNode(graph, a.id);
        assert.equal(graph.links.length, 0);
    },

    async 'graph: evaluates in dependency order; widget values fill unconnected inputs'() {
        const { graph, ev, add, link } = setup();
        const m = add('math/math', { b: 10, op: '×' }); // added first, still runs second
        const n = add('value/number', { value: 4 });
        link(n, 'value', m, 'a');
        const { results, order } = await ev.evaluate(graph);
        assert.deepEqual(order, [n.id, m.id]);
        assert.equal(results.get(m.id)!.outputs.result, 40);
    },

    async 'graph: memoized — only what changed (and downstream) re-runs'() {
        const { graph, ev, add, link } = setup();
        const a = add('value/number', { value: 1 });
        const b = add('value/number', { value: 2 });
        const sum = add('math/math');
        link(a, 'value', sum, 'a');
        link(b, 'value', sum, 'b');
        assert.equal((await ev.evaluate(graph)).ran.length, 3);
        assert.equal((await ev.evaluate(graph)).ran.length, 0);
        b.values.value = 5;
        const r = await ev.evaluate(graph);
        assert.deepEqual(r.ran.sort(), [b.id, sum.id].sort());
        assert.equal(r.results.get(sum.id)!.outputs.result, 6);
    },

    async 'graph: a list into a plain input broadcasts; list ports take whole lists'() {
        const { graph, ev, add, link } = setup();
        const grid = add('list/grid2d', { cols: 3, rows: 2, spacing: { x: 10, y: 10 } });
        const split = add('vec2/split');
        const count = add('list/count');
        link(grid, 'points', split, 'vec');
        link(split, 'x', count, 'list');
        const { results } = await ev.evaluate(graph);
        assert.deepEqual(results.get(split.id)!.outputs.x, [-10, 0, 10, -10, 0, 10]);
        assert.equal(results.get(split.id)!.lists.x, true);
        assert.equal(results.get(count.id)!.outputs.count, 6);
    },

    async 'graph: broadcasting two lists uses the longest, repeating the shorter’s last item'() {
        const { graph, ev, add, link } = setup();
        const xs = add('list/range', { start: 0, end: 4 });
        const ys = add('list/range', { start: 10, end: 12 });
        const m = add('math/math');
        link(xs, 'numbers', m, 'a');
        link(ys, 'numbers', m, 'b');
        const { results } = await ev.evaluate(graph);
        assert.deepEqual(results.get(m.id)!.outputs.result, [10, 12, 13, 14]);
    },

    async 'graph: one value into a list port becomes a one-item list'() {
        const { graph, ev, add, link } = setup();
        const n = add('value/number', { value: 7 });
        const c = add('list/count');
        link(n, 'value', c, 'list');
        assert.equal((await ev.evaluate(graph)).results.get(c.id)!.outputs.count, 1);
    },

    async 'graph: errors stay local; downstream is blocked; missing inputs are reported'() {
        const { nodes, graph, ev, add, link } = setup();
        nodes.register({ type: 'test/boom', outputs: { v: 'number' }, run: () => { throw new Error('nope'); } });
        const boom = add('test/boom');
        const after = add('math/math');
        const fine = add('value/number', { value: 1 });
        const split = add('vec2/split'); // vec input has no default → missing
        link(boom, 'v', after, 'a');
        const { results } = await ev.evaluate(graph);
        assert.ok(/nope/.test(results.get(boom.id)!.error!));
        assert.equal(results.get(after.id)!.blocked, boom.id);
        assert.equal(results.get(fine.id)!.outputs.value, 1);
        assert.ok(/vec/.test(results.get(split.id)!.error!));
    },

    async 'graph: only output nodes and their inputs run when there are outputs'() {
        const { nodes, graph, ev, add, link } = setup();
        let seen: unknown;
        nodes.register({ type: 'test/out', output: true, inputs: { v: 'any' }, run: ({ v }) => { seen = v; } });
        const used = add('value/number', { value: 42 });
        const unused = add('value/number', { value: 9 });
        const out = add('test/out');
        link(used, 'value', out, 'v');
        const { order } = await ev.evaluate(graph);
        assert.ok(!order.includes(unused.id));
        assert.equal(seen, 42);
    },

    async 'graph: re-registering a type re-runs its nodes'() {
        const { nodes, graph, ev, add } = setup();
        nodes.register({ type: 'test/k', outputs: { v: 'number' }, run: () => ({ v: 1 }) });
        const k = add('test/k');
        assert.equal((await ev.evaluate(graph)).results.get(k.id)!.outputs.v, 1);
        nodes.register({ type: 'test/k', outputs: { v: 'number' }, run: () => ({ v: 2 }) });
        assert.equal((await ev.evaluate(graph)).results.get(k.id)!.outputs.v, 2);
    },

    async 'graph: script nodes compile from source (the template works)'() {
        const { nodes, graph, ev, add } = setup();
        const def = await compileNodeScript('my/sum', SCRIPT_NODE_TEMPLATE);
        nodes.register(def);
        assert.equal(def.category, 'scripts');
        const s = add('my/sum', { a: 2, b: 3, scale: 2 });
        assert.equal((await ev.evaluate(graph)).results.get(s.id)!.outputs.result, 10);
        let threw = false;
        try { await compileNodeScript('bad', 'export const x = 1;'); } catch { threw = true; }
        assert.ok(threw);
    },

    'graph: normalizeGraph drops dangling links and rejects other formats'() {
        const g = normalizeGraph({
            format: 'n3rdw1z4rd.graph', version: 1,
            nodes: [{ id: 'a', type: 'value/number', pos: [1, 2], values: {} }],
            links: [{ id: 'l', from: { node: 'a', port: 'value' }, to: { node: 'zz', port: 'x' } }],
        });
        assert.equal(g.links.length, 0);
        let threw = false;
        try { normalizeGraph({ format: 'other' }); } catch { threw = true; }
        assert.ok(threw);
    },
};

export const graphAnimationTests: TestSuite = {
    async 'graph animation: off by default; animated nodes (and downstream) re-run per frame, the rest stay cached'() {
        const { graph, ev, add, link } = setup();
        const time = add('value/time');                   // animates by default
        const wave = add('math/wave', { period: 2 });
        const still = add('value/number', { value: 3 });
        const sum = add('math/math');
        link(time, 'time', wave, 't');
        link(wave, 'value', sum, 'a');
        link(still, 'value', sum, 'b');

        assert.deepEqual(ev.animated(graph), [time.id]);
        await ev.evaluate(graph, { frame: { time: 0, dt: 0, frame: 0 } });
        const r = await ev.evaluate(graph, { frame: { time: 0.5, dt: 0.5, frame: 1 } });
        assert.deepEqual(r.ran.sort(), [time.id, wave.id, sum.id].sort()); // `still` reused
        assert.ok(Math.abs((r.results.get(sum.id)!.outputs.result as number) - 4) < 1e-9); // sin(π/2) + 3

        time.animate = false; // switched off on the node
        assert.deepEqual(ev.animated(graph), []);
        await ev.evaluate(graph, { frame: { time: 1, dt: 0.5, frame: 2 } });
        assert.equal((await ev.evaluate(graph, { frame: { time: 2, dt: 1, frame: 3 } })).ran.length, 0);

        still.animate = true; // any node can opt in
        const r2 = await ev.evaluate(graph, { frame: { time: 3, dt: 1, frame: 4 } });
        assert.deepEqual(r2.ran.sort(), [still.id, sum.id].sort());
    },
};

export const graphMultiTests: TestSuite = {
    async 'graph: multi list inputs concatenate every link in order; plain inputs still replace'() {
        const { nodes, graph, ev, add, link } = setup();
        const a = add('list/range', { start: 0, end: 2 });
        const b = add('value/number', { value: 9 });
        const c = add('list/range', { start: 5, end: 7 });
        const merge = add('list/merge');
        link(a, 'numbers', merge, 'lists');
        link(b, 'value', merge, 'lists');
        link(c, 'numbers', merge, 'lists');
        link(c, 'numbers', merge, 'lists'); // same link again: not doubled
        assert.equal(graph.links.filter((l) => l.to.node === merge.id).length, 3);
        assert.deepEqual((await ev.evaluate(graph)).results.get(merge.id)!.outputs.list, [0, 1, 9, 5, 6]);
        let threw = false;
        try { nodes.register({ type: 'bad/multi', inputs: { x: { type: 'number', multi: true } }, run: () => ({}) }); } catch { threw = true; }
        assert.ok(threw);
    },
};

export const graphSkipTests: TestSuite = {
    async 'graph: a multi input leaves failed sources out (and says which); a plain input still blocks'() {
        const { nodes, graph, ev, add, link } = setup();
        nodes.register({ type: 'test/boom2', outputs: { v: 'number' }, run: () => { throw new Error('nope'); } });
        const good = add('list/range', { start: 0, end: 3 });
        const bad = add('test/boom2');
        const merge = add('list/merge');
        link(good, 'numbers', merge, 'lists');
        link(bad, 'v', merge, 'lists');
        const after = add('math/math');
        link(bad, 'v', after, 'a');
        const { results } = await ev.evaluate(graph);
        assert.deepEqual(results.get(merge.id)!.outputs.list, [0, 1, 2]);
        assert.deepEqual(results.get(merge.id)!.skipped, [bad.id]);
        assert.equal(results.get(after.id)!.blocked, bad.id);
        // fixing the source re-runs the merge with it included
        nodes.register({ type: 'test/boom2', outputs: { v: 'number' }, run: () => ({ v: 9 }) });
        const r2 = await ev.evaluate(graph);
        assert.deepEqual(r2.results.get(merge.id)!.outputs.list, [0, 1, 2, 9]);
        assert.equal(r2.results.get(merge.id)!.skipped, undefined);
    },
};

export const graphDisableTests: TestSuite = {
    async 'graph: disabled nodes don’t run; downstream is blocked or leaves them out; re-enabling runs them again'() {
        const { graph, ev, add, link } = setup();
        const a = add('list/range', { start: 0, end: 2 });
        const b = add('list/range', { start: 5, end: 7 });
        const merge = add('list/merge');
        const count = add('list/count');
        link(a, 'numbers', merge, 'lists');
        link(b, 'numbers', merge, 'lists');
        link(b, 'numbers', count, 'list');
        b.disabled = true;
        let r = await ev.evaluate(graph);
        assert.equal(r.results.get(b.id)!.disabled, true);
        assert.ok(!r.ran.includes(b.id));
        assert.deepEqual(r.results.get(merge.id)!.outputs.list, [0, 1]);
        assert.deepEqual(r.results.get(merge.id)!.skipped, [b.id]);
        assert.equal(r.results.get(count.id)!.blocked, b.id);
        b.disabled = false;
        r = await ev.evaluate(graph);
        assert.deepEqual(r.results.get(merge.id)!.outputs.list, [0, 1, 5, 6]);
        assert.equal(r.results.get(count.id)!.outputs.count, 2);
    },

    'graph: a disabled animated node doesn’t make the graph animated'() {
        const { graph, ev, add } = setup();
        const t = add('value/time');
        assert.equal(ev.animated(graph).length, 1);
        t.disabled = true;
        assert.equal(ev.animated(graph).length, 0);
    },
};

/** Inputs to try each built-in with (besides its defaults), so source and TS stay in step. */
const SAMPLES: Record<string, { inputs?: Record<string, unknown>; params?: Record<string, unknown>; ctx?: Record<string, number> }[]> = {
    'value/number': [{ params: { value: 4.5 } }],
    'value/vec2': [{ inputs: { x: 3, y: -2 } }],
    'value/color': [{ params: { color: '#123456' } }],
    'value/text': [{ params: { text: 'hi' } }],
    'value/time': [{ params: { speed: 2 }, ctx: { time: 1.5, dt: 0.016, frame: 90 } }],
    'math/wave': [{ inputs: { t: 0.3, period: 2, amplitude: 5 }, params: { shape: 'sine' } }, { inputs: { t: 0.7, period: 1, amplitude: 2 }, params: { shape: 'triangle' } }, { inputs: { t: 1.2, period: 1, amplitude: 1 }, params: { shape: 'saw' } }],
    'math/math': ['+', '−', '×', '÷', 'min', 'max', 'pow', 'mod'].map((op) => ({ inputs: { a: 7, b: -3 }, params: { op } })),
    'math/remap': [{ inputs: { value: 2, inMin: 0, inMax: 1, outMin: 0, outMax: 10 }, params: { clamp: true } }],
    'vec2/split': [{ inputs: { vec: { x: 1, y: 2 } } }],
    'vec2/offset': [{ inputs: { vec: { x: 1, y: 2 }, by: { x: 10, y: 20 } } }],
    'list/range': [{ inputs: { start: 5, end: 0, step: -2 } }],
    'list/grid2d': [{ inputs: { cols: 4, rows: 3, spacing: { x: 10, y: 20 }, center: { x: 1, y: 1 } }, params: { stagger: true } }],
    'list/random': [{ inputs: { count: 5, min: -1, max: 1, seed: 42 } }],
    'list/count': [{ inputs: { list: [1, 2, 3] } }],
    'list/merge': [{ inputs: { lists: [1, 'a', null] } }],
    'list/pick': [{ inputs: { list: [0, 1, 2, 3, 4, 5, 6], every: 3, offset: 1 } }],
};

export const builtinSourceTests: TestSuite = {
    async 'graph: every built-in has a source that compiles to the same interface and behaviour'() {
        const nodes = createNodeRegistry();
        for (const def of nodes.all()) {
            assert.ok(def.source, `${def.type} has no source`);
            const fromSource = await compileNodeScript(def.type, def.source!);
            const strip = (ports: readonly { name: string; type: string; default?: unknown; multi: boolean; optional: boolean }[]) =>
                ports.map((p) => [p.name, p.type, p.default, p.multi, p.optional]);
            assert.deepEqual(strip(fromSource.inputs), strip(def.inputs));
            assert.deepEqual(strip(fromSource.outputs), strip(def.outputs));
            assert.deepEqual(fromSource.params.map((p) => [p.name, p.type, p.default, p.options]), def.params.map((p) => [p.name, p.type, p.default, p.options]));
            assert.equal(fromSource.title, def.title);
            assert.equal(fromSource.animate, def.animate);

            const defaults = (ports: readonly { name: string; default?: unknown }[]) => Object.fromEntries(ports.map((p) => [p.name, p.default]));
            const cases = [{}, ...(SAMPLES[def.type] ?? [])] as { inputs?: Record<string, unknown>; params?: Record<string, unknown>; ctx?: Record<string, number> }[];
            assert.ok(SAMPLES[def.type], `add sample inputs for ${def.type}`);
            for (const c of cases) {
                const inputs = { ...defaults(def.inputs), ...c.inputs };
                const params = { ...defaults(def.params), ...c.params };
                const ctx = { nodeId: 'n', type: def.type, source: def.source, index: 0, count: 1, env: {}, time: 0, dt: 0, frame: 0, ...c.ctx };
                // nodes without defaults on every input can't run on "defaults only"
                if (!c.inputs && def.inputs.some((p) => p.default === undefined && !p.optional)) continue;
                const a = JSON.stringify(await def.run(structuredClone(inputs), params, ctx));
                const b = JSON.stringify(await fromSource.run(structuredClone(inputs), params, ctx));
                assert.equal(b, a);
            }
        }
    },
};

export const graphGroupTests: TestSuite = {
    'graph: groups survive normalizeGraph; malformed ones are dropped'() {
        const g = normalizeGraph({
            format: 'n3rdw1z4rd.graph', version: 1, nodes: [], links: [],
            groups: [{ id: 'g1', title: 'pegs', color: '#335', rect: [0, 0, 100, 50] }, { id: 'bad', rect: [0, 'x'] }, null],
        });
        assert.deepEqual(g.groups, [{ id: 'g1', title: 'pegs', color: '#335', rect: [0, 0, 100, 50] }]);
    },
};

export const moduleKindTests: TestSuite = {
    async 'graph: a host can declare module kinds: hooks instead of run, compiled with the host\'s run'() {
        const { nodes, graph, ev, add } = setup();
        const agent: ModuleKind = {
            hooks: ['update', 'collide'],
            outputs: { agent: 'any' },
            category: 'agents',
            run: (inputs, params, ctx) => ({ agent: { type: ctx.type, node: ctx.nodeId, params: { ...inputs, ...params }, source: ctx.source } }),
        };
        const src = `export const title = 'Wander';
export const inputs = { speed: { type: 'number', default: 2 } };
export const params = { turn: { type: 'boolean', default: false } };
export function update(self, dt, params) { self.x += params.speed * dt; }`;
        const def = await compileNodeScript('agents/wander', src, { kinds: [agent] });
        assert.equal(def.category, 'agents');
        assert.deepEqual(def.outputs.map((o) => [o.name, o.type]), [['agent', 'any']]);
        nodes.register(def);
        const n = add('agents/wander', { speed: 3 });
        const v = (await ev.evaluate(graph)).results.get(n.id)!.outputs.agent as any;
        assert.deepEqual([v.type, v.node, v.params, v.source === src], ['agents/wander', n.id, { speed: 3, turn: false }, true]);

        // any of the kind's hooks will do
        const other = await compileNodeScript('agents/bump', 'export function collide() {}', { kinds: [agent] });
        assert.equal(other.category, 'agents');
    },
    async 'graph: without a matching kind, a module needs a run (and the error names the hooks it could have used)'() {
        const errorOf = async (src: string, kinds?: ModuleKind[]) => {
            try {
                await compileNodeScript('x/test', src, { kinds });
                return '';
            } catch (e) {
                return String(e);
            }
        };
        assert.ok(/export a run/.test(await errorOf('export function update() {}')), 'no kinds declared: hooks mean nothing');
        const kinds: ModuleKind[] = [{ hooks: ['setup', 'step'], run: () => ({}) }];
        assert.ok(/or setup \/ step/.test(await errorOf('export const title = "nothing";', kinds)), 'the error lists the hooks');
        assert.equal(await errorOf('export function step() {}', kinds), '');
    },
};

export const subgraphTests: TestSuite = {
    async 'subgraph: collapsing nodes keeps what the graph computes (lists stay lists); expand undoes it'() {
        const { nodes, graph, ev, add, link } = setup();
        const grid = add('list/grid2d', { cols: 3, rows: 2, spacing: { x: 10, y: 10 } });
        const split = add('vec2/split');
        const scale = add('math/math', { b: 2, op: '×' });
        const count = add('list/count');
        const merge = add('list/merge');
        link(grid, 'points', split, 'vec');
        link(split, 'x', scale, 'a');
        link(scale, 'result', merge, 'lists');
        link(merge, 'list', count, 'list');
        const before = (await ev.evaluate(graph)).results;
        const expected = before.get(merge.id)!.outputs.list;

        const { type, node } = collapseToSubgraph(graph, nodes, [split.id, scale.id], 'Double X');
        assert.equal(type, 'subgraph/double-x');
        assert.equal(graph.nodes.length, 4);
        const def = graph.subgraphs![type];
        assert.deepEqual(def.inputs.map((p) => [p.name, p.type, p.to.length]), [['vec', 'vec2', 1]]);
        assert.deepEqual(def.outputs.map((p) => [p.name, p.type]), [['result', 'number']]);

        const after = (await ev.evaluate(graph)).results;
        assert.equal(after.get(node.id)!.error, undefined);
        assert.equal(after.get(node.id)!.lists.result, true); // the inner node broadcast: still a list
        assert.deepEqual(after.get(merge.id)!.outputs.list, expected);

        const back = expandSubgraph(graph, node.id);
        assert.equal(back.length, 2);
        assert.deepEqual((await ev.evaluate(graph)).results.get(merge.id)!.outputs.list, expected);
    },

    async 'subgraph: each instance has its own scope (distinct ctx.nodeId) and cache'() {
        const { nodes, graph, ev, add, link } = setup();
        nodes.register({ type: 'test/who', inputs: { x: { type: 'number', default: 0 } }, outputs: { id: 'string' }, run: ({ x }, _p, ctx) => ({ id: `${ctx.nodeId}:${x}` }) });
        const n1 = add('value/number', { value: 1 });
        const who = add('test/who');
        link(n1, 'value', who, 'x');
        const merge = add('list/merge');
        link(who, 'id', merge, 'lists');
        const { node: a } = collapseToSubgraph(graph, nodes, [who.id], 'Who');
        // a second instance of the same type, fed differently
        const n2 = add('value/number', { value: 2 });
        const b = add(graph.subgraphs ? Object.keys(graph.subgraphs)[0] : '');
        link(n2, 'value', b, 'x');
        link(b, 'id', merge, 'lists');
        const out = (await ev.evaluate(graph)).results.get(merge.id)!.outputs.list as string[];
        assert.equal(out.length, 2);
        assert.ok(out[0] !== out[1] && out[0].startsWith(`${a.id}#0/`) && out[1].startsWith(`${b.id}#0/`), out.join(' | '));
        assert.ok(out[0].endsWith(':1') && out[1].endsWith(':2'));
    },

    async 'subgraph: errors inside surface on the subgraph node; output nodes stay outside'() {
        const { nodes, graph, ev, add, link } = setup();
        nodes.register({ type: 'test/boom3', inputs: { x: { type: 'number', default: 0 } }, outputs: { v: 'number' }, run: () => { throw new Error('nope'); } });
        nodes.register({ type: 'test/out2', output: true, inputs: { v: 'any' }, run: () => {} });
        const n = add('value/number');
        const boom = add('test/boom3');
        const out = add('test/out2');
        link(n, 'value', boom, 'x');
        link(boom, 'v', out, 'v');
        const { node } = collapseToSubgraph(graph, nodes, [boom.id, out.id], 'Boom');
        assert.ok(getNode(graph, out.id)); // the output node stayed
        const r = (await ev.evaluate(graph)).results.get(node.id)!;
        assert.ok(/inside, boom3: Error: nope/.test(r.error ?? ''), r.error);
    },

    async 'subgraph: registerSubgraphs restores types from a saved document'() {
        const { nodes, graph, add, link } = setup();
        const a = add('value/number', { value: 5 });
        const m = add('math/math', { b: 3, op: '×' });
        const c = add('list/count');
        link(a, 'value', m, 'a');
        link(m, 'result', c, 'list');
        collapseToSubgraph(graph, nodes, [m.id], 'Triple');
        const saved = JSON.parse(JSON.stringify(graph));
        const fresh = createNodeRegistry();
        registerSubgraphs(saved, fresh);
        const r = (await new GraphEvaluator(fresh).evaluate(saved)).results;
        const sub = saved.nodes.find((n: any) => n.type.startsWith('subgraph/'));
        assert.equal(r.get(sub.id)!.outputs.result, 15);
    },
};
