import type { NodeDef, NodeRegistry } from './node';
import { portTypes, type TypeRegistry } from './types';

/**
 * The graph document: plain JSON, saved and shared as-is.
 *
 * ```json
 * {
 *   "format": "n3rdw1z4rd.graph", "version": 1,
 *   "nodes": [{ "id": "a1", "type": "list/grid2d", "pos": [0, 0], "values": { "cols": 14 } }],
 *   "links": [{ "id": "l1", "from": { "node": "a1", "port": "points" }, "to": { "node": "b2", "port": "at" } }],
 *   "scripts": { "my/ball": "export const inputs = …" }
 * }
 * ```
 *
 * `values` holds the node's params and the values of its unconnected inputs; `scripts` holds
 * the source of the script node types the graph uses, so a graph file is self-contained.
 *
 * @module
 */

export const GRAPH_FORMAT = 'n3rdw1z4rd.graph';
export const GRAPH_VERSION = 1;

/** @category Graph */
export interface GraphNode {
    id: string;
    type: string;
    /** top-left, in graph units */
    pos: [number, number];
    /** set when resized (e.g. an output viewport) */
    size?: [number, number];
    /** params and unconnected-input values, by name */
    values: Record<string, unknown>;
    /** shown instead of the type's title */
    title?: string;
    collapsed?: boolean;
    /** re-run every frame while animating (overrides the type's default) */
    animate?: boolean;
}

/** @category Graph */
export interface PortRef {
    node: string;
    port: string;
}

/** @category Graph */
export interface GraphLink {
    id: string;
    from: PortRef;
    to: PortRef;
}

/** @category Graph */
export interface GraphDoc {
    format: typeof GRAPH_FORMAT;
    version: number;
    nodes: GraphNode[];
    links: GraphLink[];
    /** script node type → ES module source */
    scripts?: Record<string, string>;
    meta?: Record<string, unknown>;
}

/** @category Graph */
export function createGraph(): GraphDoc {
    return { format: GRAPH_FORMAT, version: GRAPH_VERSION, nodes: [], links: [] };
}

let idCounter = 0;
/** A short id, unique within a graph (random part + counter). @category Graph */
export function graphId(prefix = 'n'): string {
    return `${prefix}${Math.random().toString(36).slice(2, 7)}${(idCounter++).toString(36)}`;
}

/** Checks a parsed JSON value is a graph document and fills in missing optional parts. @category Graph */
export function normalizeGraph(raw: unknown): GraphDoc {
    const g = raw as Partial<GraphDoc> | null;
    if (!g || g.format !== GRAPH_FORMAT) throw new Error('not a graph document');
    if (typeof g.version !== 'number' || g.version > GRAPH_VERSION) throw new Error(`unsupported graph version ${g.version}`);
    const nodes = (Array.isArray(g.nodes) ? g.nodes : []).filter((n): n is GraphNode => !!n && typeof n.id === 'string' && typeof n.type === 'string')
        .map((n) => ({ ...n, pos: Array.isArray(n.pos) ? [Number(n.pos[0]) || 0, Number(n.pos[1]) || 0] as [number, number] : [0, 0] as [number, number], values: n.values && typeof n.values === 'object' ? n.values : {} }));
    const ids = new Set(nodes.map((n) => n.id));
    const links = (Array.isArray(g.links) ? g.links : []).filter((l): l is GraphLink =>
        !!l && typeof l.id === 'string' && ids.has(l.from?.node) && ids.has(l.to?.node) && typeof l.from.port === 'string' && typeof l.to.port === 'string');
    return { ...g, format: GRAPH_FORMAT, version: GRAPH_VERSION, nodes, links } as GraphDoc;
}

/** @category Graph */
export function getNode(doc: GraphDoc, id: string): GraphNode | undefined {
    return doc.nodes.find((n) => n.id === id);
}

/** The link into an input, if any (the first, for a multi input). @category Graph */
export function linkInto(doc: GraphDoc, node: string, port: string): GraphLink | undefined {
    return doc.links.find((l) => l.to.node === node && l.to.port === port);
}

/** Every link into an input, in the order they were made. @category Graph */
export function linksInto(doc: GraphDoc, node: string, port: string): GraphLink[] {
    return doc.links.filter((l) => l.to.node === node && l.to.port === port);
}

/** Adds a node of `def`'s type with its default values. @category Graph */
export function addNode(doc: GraphDoc, def: NodeDef, pos: [number, number] = [0, 0], values: Record<string, unknown> = {}): GraphNode {
    const node: GraphNode = { id: graphId(), type: def.type, pos: [pos[0], pos[1]], values: {} };
    for (const p of def.params) if (p.default !== undefined) node.values[p.name] = clone(p.default);
    for (const p of def.inputs) if (p.default !== undefined) node.values[p.name] = clone(p.default);
    Object.assign(node.values, clone(values));
    doc.nodes.push(node);
    return node;
}

/** Removes a node and every link to or from it. @category Graph */
export function removeNode(doc: GraphDoc, id: string): void {
    doc.nodes = doc.nodes.filter((n) => n.id !== id);
    doc.links = doc.links.filter((l) => l.from.node !== id && l.to.node !== id);
}

/** @category Graph */
export type ConnectCheck = { ok: true } | { ok: false; reason: string };

/**
 * Whether `from` (an output) may connect to `to` (an input): both exist, the types fit,
 * and it wouldn't make a cycle. An input's existing link doesn't block (it gets replaced).
 *
 * @category Graph
 */
export function canConnect(doc: GraphDoc, registry: NodeRegistry, from: PortRef, to: PortRef, types: TypeRegistry = portTypes): ConnectCheck {
    const a = getNode(doc, from.node);
    const b = getNode(doc, to.node);
    if (!a || !b) return { ok: false, reason: 'no such node' };
    if (a.id === b.id) return { ok: false, reason: 'a node can’t connect to itself' };
    const out = registry.get(a.type)?.outputs.find((p) => p.name === from.port);
    const inp = registry.get(b.type)?.inputs.find((p) => p.name === to.port);
    if (!out) return { ok: false, reason: `no output "${from.port}"` };
    if (!inp) return { ok: false, reason: `no input "${to.port}"` };
    if (!types.canConnect(out.type, inp.type)) return { ok: false, reason: `${out.type} doesn’t fit ${inp.type}` };
    if (reaches(doc, b.id, a.id)) return { ok: false, reason: 'that would make a loop' };
    return { ok: true };
}

/**
 * Connects an output to an input; throws if it can't. A plain input's existing link is
 * replaced; a multi input keeps its links and adds this one (an identical link isn't doubled).
 *
 * @category Graph
 */
export function connect(doc: GraphDoc, registry: NodeRegistry, from: PortRef, to: PortRef, types: TypeRegistry = portTypes): GraphLink {
    const check = canConnect(doc, registry, from, to, types);
    if (!check.ok) throw new Error(check.reason);
    const multi = registry.get(getNode(doc, to.node)!.type)?.inputs.find((p) => p.name === to.port)?.multi;
    const same = doc.links.find((l) => l.to.node === to.node && l.to.port === to.port && l.from.node === from.node && l.from.port === from.port);
    if (multi && same) return same;
    if (!multi) doc.links = doc.links.filter((l) => !(l.to.node === to.node && l.to.port === to.port));
    const link: GraphLink = { id: graphId('l'), from: { ...from }, to: { ...to } };
    doc.links.push(link);
    return link;
}

/** @category Graph */
export function disconnect(doc: GraphDoc, linkId: string): void {
    doc.links = doc.links.filter((l) => l.id !== linkId);
}

/** Whether following links downstream from `start` reaches `target`. */
function reaches(doc: GraphDoc, start: string, target: string): boolean {
    const seen = new Set<string>();
    const stack = [start];
    while (stack.length) {
        const id = stack.pop()!;
        if (id === target) return true;
        if (seen.has(id)) continue;
        seen.add(id);
        for (const l of doc.links) if (l.from.node === id) stack.push(l.to.node);
    }
    return false;
}

function clone<T>(v: T): T {
    return v !== null && typeof v === 'object' ? structuredClone(v) : v;
}
