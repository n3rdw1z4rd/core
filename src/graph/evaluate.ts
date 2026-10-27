import { getNode, linksInto, type GraphDoc } from './doc';
import type { NodeDef, NodeRegistry, Port } from './node';

/**
 * Evaluates a graph: runs the nodes the outputs depend on, in dependency order, passing
 * values along the links.
 *
 * - **Lazy:** only output nodes (`output: true`) and what they depend on run, unless you
 *   name other targets.
 * - **Memoized:** a node re-runs only when its params / input values, an upstream result or
 *   its type changed since the last evaluation; otherwise its previous outputs are reused.
 * - **List broadcasting:** a list wired into a single-value input runs the node once per
 *   item (several lists: longest wins, shorter ones repeat their last item) and every
 *   output becomes a list. A list port (`vec2[]`) takes the whole list instead; one value
 *   wired into it arrives as a one-item list. A list output of a broadcast node is
 *   flattened into the result list.
 * - **Animation (optional):** a node with `animate` on (per node, or its type's default)
 *   re-runs on every evaluation that passes a new `frame`, and so does everything downstream
 *   of it; the rest stays cached. {@link GraphEvaluator.animated} tells the host whether any
 *   output depends on an animated node — if not, there's nothing to re-evaluate per frame.
 * - **Disabled nodes** (`GraphNode.disabled`) don't run; downstream they count as failed
 *   (blocked, or left out of a multi input).
 * - **Errors stay local:** a throwing node gets an `error`; nodes downstream of it are
 *   `blocked` (skipped) and don't run; the rest of the graph still evaluates. A **multi**
 *   input leaves failed sources out instead (listed in `skipped`), so one broken branch
 *   doesn't take down everything it feeds into.
 *
 * Nodes must treat their inputs as read-only: values are shared with upstream caches.
 *
 * @category Graph
 */
export class GraphEvaluator {
    private readonly cache = new Map<string, CachedResult>();
    private stamp = 0;

    constructor(readonly registry: NodeRegistry) {}

    /** The last result of a node. */
    result(nodeId: string): NodeResult | undefined {
        return this.cache.get(nodeId);
    }

    /** Forgets cached results (all, or one node's), so they re-run next time. */
    invalidate(nodeId?: string): void {
        if (nodeId === undefined) this.cache.clear();
        else this.cache.delete(nodeId);
    }

    /** The animated nodes the outputs (or `targets`) depend on; empty: no need to evaluate per frame. */
    animated(doc: GraphDoc, targets?: string[]): string[] {
        const { order } = this.order(doc, targets ?? this.defaultTargets(doc));
        return order.filter((id) => {
            const node = getNode(doc, id)!;
            return !node.disabled && (node.animate ?? this.registry.get(node.type)?.animate ?? false);
        });
    }

    async evaluate(doc: GraphDoc, options: EvaluateOptions = {}): Promise<EvaluateResult> {
        const env = options.env ?? {};
        const frame = options.frame ?? { time: 0, dt: 0, frame: 0 };
        const scope = options.scope ? `${options.scope}/` : '';
        const targets = options.targets ?? this.defaultTargets(doc);
        const { order, cyclic } = this.order(doc, targets);
        const ran: string[] = [];
        const results = new Map<string, NodeResult>();

        for (const id of order) {
            const node = getNode(doc, id)!;
            const def = this.registry.get(node.type);
            if (!def) {
                results.set(id, this.store(id, '', fail(`unknown node type "${node.type}"`)));
                continue;
            }
            if (cyclic.has(id)) {
                results.set(id, this.store(id, '', fail('part of a loop')));
                continue;
            }
            if (node.disabled) {
                results.set(id, this.store(id, '', { outputs: {}, lists: {}, disabled: true, ms: 0 }));
                continue;
            }

            // gather inputs
            const values: Record<string, unknown> = {};
            const isList: Record<string, boolean> = {};
            const keyParts: unknown[] = [def.type, def.revision];
            if (node.animate ?? def.animate) keyParts.push(['frame', frame.frame, frame.time]);
            let blocked: string | undefined;
            let missing: string | undefined;
            const skipped: string[] = [];

            for (const p of def.inputs) {
                const links = linksInto(doc, id, p.name);
                const external = options.externals?.get(`${id}:${p.name}`);
                if (!links.length && external?.length) {
                    // fed from outside (a subgraph's inputs)
                    keyParts.push([p.name, 'external', options.externalsStamp ?? 0]);
                    if (p.multi) {
                        values[p.name] = external.flatMap((x) => (x.list ? (x.value as unknown[]) : x.value === undefined ? [] : [x.value]));
                        isList[p.name] = true;
                    } else {
                        values[p.name] = external[0].value;
                        isList[p.name] = external[0].list;
                    }
                } else if (links.length) {
                    const gathered: unknown[] = [];
                    for (const link of p.multi ? links : links.slice(0, 1)) {
                        const src = results.get(link.from.node);
                        if (!src || src.error || src.blocked || src.disabled) {
                            if (p.multi) skipped.push(link.from.node); // leave it out, keep going
                            else blocked ??= link.from.node;
                            keyParts.push([p.name, link.from.node, 'failed']);
                            continue;
                        }
                        const v = src.outputs[link.from.port];
                        const list = !!src.lists[link.from.port];
                        keyParts.push([p.name, link.from.node, src.stamp, link.from.port]);
                        if (!p.multi) {
                            values[p.name] = v;
                            isList[p.name] = list;
                        } else if (list) {
                            gathered.push(...(v as unknown[]));
                        } else if (v !== undefined) {
                            gathered.push(v);
                        }
                    }
                    if (p.multi) {
                        values[p.name] = gathered;
                        isList[p.name] = true;
                    }
                } else {
                    const v = node.values[p.name] ?? p.default;
                    values[p.name] = v;
                    isList[p.name] = p.list && Array.isArray(v);
                    keyParts.push([p.name, v]);
                    if (v === undefined && !p.optional) missing ??= p.name;
                }
            }

            if (blocked) {
                results.set(id, this.store(id, '', { ...fail(''), error: undefined, blocked }));
                continue;
            }
            if (missing) {
                results.set(id, this.store(id, '', fail(`input "${missing}" needs a value or a link`)));
                continue;
            }

            const params: Record<string, unknown> = {};
            for (const p of def.params) params[p.name] = node.values[p.name] ?? p.default;
            keyParts.push(params);

            const key = safeKey(keyParts);
            const prev = this.cache.get(id);
            if (prev && key && prev.key === key && !prev.error) {
                results.set(id, prev);
                continue;
            }

            const res = await this.run(def, scope + id, values, isList, params, env, frame);
            if (skipped.length) res.skipped = skipped;
            ran.push(id);
            results.set(id, this.store(id, key, res));
        }

        // drop results of nodes that are gone
        for (const id of [...this.cache.keys()]) if (!getNode(doc, id)) this.cache.delete(id);

        return { order, ran, results };
    }

    private defaultTargets(doc: GraphDoc): string[] {
        const outputs = doc.nodes.filter((n) => this.registry.get(n.type)?.output).map((n) => n.id);
        return outputs.length ? outputs : doc.nodes.map((n) => n.id);
    }

    /** Dependency order (upstream first) of the targets and everything they depend on. */
    private order(doc: GraphDoc, targets: string[]): { order: string[]; cyclic: Set<string> } {
        const order: string[] = [];
        const done = new Set<string>();
        const active = new Set<string>();
        const cyclic = new Set<string>();

        const visit = (id: string) => {
            if (done.has(id)) return;
            if (active.has(id)) {
                for (const a of active) cyclic.add(a);
                return;
            }
            if (!getNode(doc, id)) return;
            active.add(id);
            for (const l of doc.links) if (l.to.node === id) visit(l.from.node);
            active.delete(id);
            done.add(id);
            order.push(id);
        };
        for (const t of targets) visit(t);
        return { order, cyclic };
    }

    private async run(def: NodeDef, nodeId: string, values: Record<string, unknown>, isList: Record<string, boolean>,
        params: Record<string, unknown>, env: Record<string, unknown>, frame: FrameInfo): Promise<Omit<NodeResult, 'stamp'>> {
        const t0 = now();
        const broadcast: Port[] = [];
        for (const p of def.inputs) {
            if (p.list) {
                if (!isList[p.name]) values[p.name] = values[p.name] === undefined ? [] : [values[p.name]];
            } else if (isList[p.name]) {
                broadcast.push(p);
            }
        }

        const outputs: Record<string, unknown> = {};
        const lists: Record<string, boolean> = {};

        try {
            if (broadcast.length === 0) {
                const r = (await def.run(values, params, { nodeId, type: def.type, source: def.source, index: 0, count: 1, env, ...frame })) ?? {};
                // a run may say which of its outputs are lists (subgraphs pass on their inner nodes')
                const said = (r as Record<string, unknown>)[OUTPUT_LISTS] as Record<string, boolean> | undefined;
                for (const o of def.outputs) {
                    outputs[o.name] = r[o.name];
                    lists[o.name] = said?.[o.name] ?? o.list;
                }
            } else {
                const lens = broadcast.map((p) => (values[p.name] as unknown[]).length);
                const count = lens.some((n) => n === 0) ? 0 : Math.max(...lens);
                for (const o of def.outputs) {
                    outputs[o.name] = [];
                    lists[o.name] = true;
                }
                for (let i = 0; i < count; i++) {
                    const args = { ...values };
                    broadcast.forEach((p, k) => {
                        const list = values[p.name] as unknown[];
                        args[p.name] = list[Math.min(i, lens[k] - 1)];
                    });
                    const r = (await def.run(args, params, { nodeId, type: def.type, source: def.source, index: i, count, env, ...frame })) ?? {};
                    for (const o of def.outputs) {
                        const v = r[o.name];
                        if (o.list && Array.isArray(v)) (outputs[o.name] as unknown[]).push(...v);
                        else (outputs[o.name] as unknown[]).push(v);
                    }
                }
            }
        } catch (err) {
            return { ...fail(describe(err)), ms: now() - t0 };
        }

        return { outputs, lists, ms: now() - t0 };
    }

    private store(id: string, key: string, res: Omit<NodeResult, 'stamp'>): CachedResult {
        const r: CachedResult = { ...res, stamp: ++this.stamp, key };
        this.cache.set(id, r);
        return r;
    }
}

/** @category Graph */
export interface EvaluateOptions {
    /** nodes to evaluate (with their dependencies); default: the output nodes, or every node if there are none */
    targets?: string[];
    /** passed to every node as `ctx.env` (not part of the cache key: `invalidate()` when it changes) */
    env?: Record<string, unknown>;
    /** the current frame while animating: animated nodes re-run when it changes */
    frame?: FrameInfo;
    /**
     * Values for inputs that have no link, by `"<node>:<port>"` — how a subgraph's inputs
     * reach its inner nodes. Bump `externalsStamp` when they change.
     */
    externals?: Map<string, { value: unknown; list: boolean }[]>;
    externalsStamp?: number;
    /** prefixes `ctx.nodeId` (`<scope>/<id>`), so instances of a subgraph make distinct ids */
    scope?: string;
}

/**
 * A key a node's `run` may add to its result: `{ [OUTPUT_LISTS]: { out: true } }` marks outputs
 * as lists regardless of their declared type.
 *
 * @category Graph
 */
export const OUTPUT_LISTS = '__lists';

/** @category Graph */
export interface FrameInfo {
    /** seconds since animation started */
    time: number;
    /** seconds since the last frame */
    dt: number;
    /** frame number */
    frame: number;
}

/** @category Graph */
export interface NodeResult {
    /** output values by port name */
    outputs: Record<string, unknown>;
    /** which outputs are lists */
    lists: Record<string, boolean>;
    /** the node threw (or couldn't run) */
    error?: string;
    /** switched off by the user: didn't run */
    disabled?: boolean;
    /** an upstream node failed, was blocked or is disabled, so this one didn't run: its id */
    blocked?: string;
    /** multi inputs only: sources that failed and were left out (the node still ran) */
    skipped?: string[];
    /** time spent in run(), ms */
    ms: number;
    /** changes whenever the node actually re-ran */
    stamp: number;
}

/** @category Graph */
export interface EvaluateResult {
    /** every evaluated node, upstream first */
    order: string[];
    /** the nodes that actually ran (the rest reused cached results) */
    ran: string[];
    results: Map<string, NodeResult>;
}

interface CachedResult extends NodeResult {
    key: string;
}

function fail(error: string): Omit<NodeResult, 'stamp'> {
    return { outputs: {}, lists: {}, error, ms: 0 };
}

function describe(err: unknown): string {
    return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}

/** A cache key; '' (never matches) if something in it can't be serialized. */
function safeKey(parts: unknown[]): string {
    try {
        return JSON.stringify(parts);
    } catch {
        return '';
    }
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Re-exported for convenience. */
export type { GraphDoc };
