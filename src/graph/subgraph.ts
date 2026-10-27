import { getNode, graphId, type GraphDoc, type GraphLink, type GraphNode, type PortRef, type SubgraphDef } from './doc';
import { GraphEvaluator, OUTPUT_LISTS } from './evaluate';
import type { NodeRegistry, NodeSpec } from './node';

/**
 * Subgraphs: a selection of nodes collapsed into one node type. The inner graph is stored in
 * `doc.subgraphs[type]` with its interface — every wire that crossed the selection's edge
 * became an input or output. A subgraph node evaluates its inner graph (with its own cache per
 * instance), feeding the inner ports from its inputs.
 *
 * @module
 */

/** The node spec for a subgraph type: runs the inner graph. */
export function subgraphSpec(type: string, def: SubgraphDef, registry: NodeRegistry): NodeSpec {
    const inner: GraphDoc = { format: 'n3rdw1z4rd.graph', version: 1, nodes: def.nodes, links: def.links };
    const evaluators = new Map<string, GraphEvaluator>();
    let stamp = 0;
    const probe = new GraphEvaluator(registry);
    const targets = [...new Set(def.outputs.map((o) => o.from.node))];

    return {
        type,
        title: def.title,
        category: 'subgraph',
        description: `a subgraph of ${def.nodes.length} node${def.nodes.length === 1 ? '' : 's'} (double-click to go inside)`,
        inputs: Object.fromEntries(def.inputs.map((p) => [p.name, { type: p.type, multi: !!p.multi, optional: true }])),
        outputs: Object.fromEntries(def.outputs.map((p) => [p.name, p.type])),
        animate: probe.animated(inner, targets).length > 0,
        async run(inputs, _params, ctx) {
            const key = `${ctx.nodeId}#${ctx.index}`;
            let ev = evaluators.get(key);
            if (!ev) evaluators.set(key, (ev = new GraphEvaluator(registry)));

            const externals = new Map<string, { value: unknown; list: boolean }[]>();
            for (const p of def.inputs) {
                const v = inputs[p.name];
                if (v === undefined) continue;
                const list = p.type.trim().endsWith('[]');
                for (const to of p.to) {
                    const k = `${to.node}:${to.port}`;
                    externals.set(k, [...(externals.get(k) ?? []), { value: v, list }]);
                }
            }

            const r = await ev.evaluate(inner, {
                targets, externals, externalsStamp: ++stamp, scope: key, env: ctx.env,
                frame: { time: ctx.time, dt: ctx.dt, frame: ctx.frame },
            });

            const out: Record<string, unknown> = {};
            const lists: Record<string, boolean> = {};
            for (const o of def.outputs) {
                const res = r.results.get(o.from.node);
                if (!res) throw new Error(`inside: node ${o.from.node} is missing`);
                const node = getNode(inner, o.from.node);
                const name = node?.title ?? registry.get(node?.type ?? '')?.title ?? o.from.node;
                if (res.error) throw new Error(`inside, ${name}: ${res.error}`);
                if (res.disabled) throw new Error(`inside, ${name} is disabled`);
                if (res.blocked) {
                    const up = getNode(inner, res.blocked);
                    throw new Error(`inside, ${name} is waiting on ${up?.title ?? registry.get(up?.type ?? '')?.title ?? res.blocked}`);
                }
                out[o.name] = res.outputs[o.from.port];
                lists[o.name] = !!res.lists[o.from.port];
            }
            return { ...out, [OUTPUT_LISTS]: lists };
        },
    };
}

const registered = new Map<string, string>();

/**
 * Registers (or updates) every subgraph type a document defines. Unchanged definitions are
 * left alone (so their nodes keep their caches). Definitions may use each other.
 */
export function registerSubgraphs(doc: GraphDoc, registry: NodeRegistry): void {
    for (const [type, def] of Object.entries(doc.subgraphs ?? {})) {
        const json = JSON.stringify(def);
        if (registered.get(type) === json && registry.get(type)) continue;
        registered.set(type, json);
        registry.register(subgraphSpec(type, def, registry));
    }
}

/** A free type name for a subgraph (`subgraph/name`, `subgraph/name-2`, …). */
export function freeSubgraphType(doc: GraphDoc, registry: NodeRegistry, name: string): string {
    const base = `subgraph/${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'subgraph'}`;
    let type = base;
    for (let k = 2; registry.get(type) || doc.subgraphs?.[type]; k++) type = `${base}-${k}`;
    return type;
}

/**
 * Collapses nodes into a new subgraph type and puts one node of it in their place, wired to
 * everything they were wired to. Output nodes (like a viewport) can't go into a subgraph.
 */
export function collapseToSubgraph(doc: GraphDoc, registry: NodeRegistry, nodeIds: string[], title = 'Subgraph'): { type: string; node: GraphNode } {
    const ids = new Set(nodeIds.filter((id) => {
        const n = getNode(doc, id);
        return n && !registry.get(n.type)?.output;
    }));
    if (!ids.size) throw new Error('select some nodes (output nodes stay outside)');
    const type = freeSubgraphType(doc, registry, title);

    const inside = doc.nodes.filter((n) => ids.has(n.id));
    const internal = doc.links.filter((l) => ids.has(l.from.node) && ids.has(l.to.node));
    const incoming = doc.links.filter((l) => !ids.has(l.from.node) && ids.has(l.to.node));
    const outgoing = doc.links.filter((l) => ids.has(l.from.node) && !ids.has(l.to.node));

    const used = new Set<string>();
    const unique = (name: string) => {
        let n = name;
        for (let k = 2; used.has(n); k++) n = `${name}${k}`;
        used.add(n);
        return n;
    };
    const portOf = (ref: PortRef, dir: 'in' | 'out') => {
        const def = registry.get(getNode(doc, ref.node)!.type);
        return (dir === 'in' ? def?.inputs : def?.outputs)?.find((p) => p.name === ref.port);
    };

    // one input per outside source (it may feed several inner ports)
    const inputs: SubgraphDef['inputs'] = [];
    const inputBySource = new Map<string, SubgraphDef['inputs'][number]>();
    const outerIn: { source: PortRef; input: string }[] = [];
    for (const l of incoming) {
        const k = `${l.from.node}:${l.from.port}`;
        let input = inputBySource.get(k);
        if (!input) {
            const p = portOf(l.to, 'in');
            input = { name: unique(l.to.port), type: p?.type ?? 'any', ...(p?.multi ? { multi: true } : {}), to: [] };
            inputBySource.set(k, input);
            inputs.push(input);
            outerIn.push({ source: l.from, input: input.name });
        }
        input.to.push({ ...l.to });
    }

    // one output per inner source that something outside reads
    used.clear();
    const outputs: SubgraphDef['outputs'] = [];
    const outputBySource = new Map<string, string>();
    for (const l of outgoing) {
        const k = `${l.from.node}:${l.from.port}`;
        if (outputBySource.has(k)) continue;
        const name = unique(l.from.port);
        outputBySource.set(k, name);
        outputs.push({ name, type: portOf(l.from, 'out')?.type ?? 'any', from: { ...l.from } });
    }

    let minX = Infinity, minY = Infinity, sumX = 0, sumY = 0;
    for (const n of inside) {
        minX = Math.min(minX, n.pos[0]);
        minY = Math.min(minY, n.pos[1]);
        sumX += n.pos[0];
        sumY += n.pos[1];
    }
    const def: SubgraphDef = {
        title,
        nodes: inside.map((n) => ({ ...structuredClone(n), pos: [n.pos[0] - minX, n.pos[1] - minY] as [number, number] })),
        links: internal.map((l) => structuredClone(l)),
        inputs,
        outputs,
    };
    doc.subgraphs = { ...(doc.subgraphs ?? {}), [type]: def };
    registry.register(subgraphSpec(type, def, registry));

    // swap the nodes for one subgraph node, wired in their place
    const node: GraphNode = { id: graphId(), type, pos: [Math.round(sumX / inside.length), Math.round(sumY / inside.length)], values: {} };
    doc.nodes = doc.nodes.filter((n) => !ids.has(n.id));
    doc.nodes.push(node);
    doc.links = doc.links.filter((l) => !ids.has(l.from.node) && !ids.has(l.to.node));
    for (const { source, input } of outerIn) doc.links.push({ id: graphId('l'), from: { ...source }, to: { node: node.id, port: input } });
    for (const l of outgoing) {
        doc.links.push({ id: graphId('l'), from: { node: node.id, port: outputBySource.get(`${l.from.node}:${l.from.port}`)! }, to: { ...l.to } });
    }
    return { type, node };
}

/**
 * Replaces a subgraph node with a copy of its inner nodes (fresh ids), wired as the
 * subgraph's inputs and outputs were. Returns the new node ids. The type stays defined.
 * `defs`: where the definitions are (default: `doc.subgraphs`; pass the top-level document's
 * when `doc` is itself a subgraph's inner graph).
 */
export function expandSubgraph(doc: GraphDoc, nodeId: string, defs = doc.subgraphs): string[] {
    const node = getNode(doc, nodeId);
    const def = node && defs?.[node.type];
    if (!node || !def) throw new Error('not a subgraph node');

    const ids = new Map<string, string>();
    for (const n of def.nodes) {
        const id = graphId();
        ids.set(n.id, id);
        doc.nodes.push({ ...structuredClone(n), id, pos: [n.pos[0] + node.pos[0], n.pos[1] + node.pos[1]] });
    }
    const links: GraphLink[] = def.links.map((l) => ({ id: graphId('l'), from: { node: ids.get(l.from.node)!, port: l.from.port }, to: { node: ids.get(l.to.node)!, port: l.to.port } }));
    for (const l of doc.links) {
        if (l.to.node === nodeId) {
            const input = def.inputs.find((p) => p.name === l.to.port);
            for (const to of input?.to ?? []) links.push({ id: graphId('l'), from: { ...l.from }, to: { node: ids.get(to.node)!, port: to.port } });
        } else if (l.from.node === nodeId) {
            const output = def.outputs.find((p) => p.name === l.from.port);
            if (output) links.push({ id: graphId('l'), from: { node: ids.get(output.from.node)!, port: output.from.port }, to: { ...l.to } });
        } else {
            links.push(l);
        }
    }
    doc.links = links;
    doc.nodes = doc.nodes.filter((n) => n.id !== nodeId);
    return [...ids.values()];
}
