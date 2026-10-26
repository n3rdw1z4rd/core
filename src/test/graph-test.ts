import { assert, type TestSuite } from './assert';
import {
    GraphEvaluator, SCRIPT_NODE_TEMPLATE, addNode, canConnect, compileNodeScript, connect, createGraph, createNodeRegistry,
    defineNode, normalizeGraph, removeNode,
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
