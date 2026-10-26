import { parseType, type ParsedType } from './types';

/**
 * Node definitions: a node is a function with a typed interface.
 *
 * - **inputs** are pins wired from other nodes' outputs. An unconnected input uses the
 *   value set on the node in the editor (an inline widget), or its `default`.
 * - **params** are settings shown as widgets on the node; they can't be wired.
 * - **outputs** are what `run` returns.
 *
 * Built-in nodes are written in TypeScript with {@link defineNode}; script nodes are plain
 * ES modules with the same exports (see {@link compileNodeScript}), so logic is code you
 * write by hand and the graph only wires data between functions.
 *
 * ```ts
 * defineNode({
 *     type: 'shapes/ball',
 *     inputs: { at: 'vec2', radius: { type: 'number', default: 8, min: 0.5 } },
 *     params: { color: { type: 'color', default: '#e8554e' } },
 *     outputs: { entity: 'entity' },
 *     run: ({ at, radius }, { color }) => ({ entity: { shape: 'ball', x: at.x, y: at.y, r: radius, color } }),
 * });
 * ```
 *
 * @module
 */

/** How a value is edited in the editor (for params, and unconnected inputs). @category Graph */
export interface WidgetSpec {
    default?: unknown;
    label?: string;
    min?: number;
    max?: number;
    step?: number;
    /** choices for `enum` */
    options?: readonly string[];
    /** `string` params: a multi-line editor (code, text) */
    multiline?: boolean;
}

/** An input or output: a type string, or a type with widget settings. @category Graph */
export type PortSpec = string | ({
    type: string;
    optional?: boolean;
    description?: string;
    /** list inputs only: accept several links, concatenated in the order they were made */
    multi?: boolean;
} & WidgetSpec);

/** A param: a widget on the node. Types: number, boolean, string, color, enum, vec2. @category Graph */
export type ParamSpec = { type: string; description?: string } & WidgetSpec;

/** What `run` gets besides its inputs and params. @category Graph */
export interface RunContext {
    /** the node instance's id */
    nodeId: string;
    /** while broadcasting over lists: this call's index (else 0) and the call count (else 1) */
    index: number;
    count: number;
    /** anything the host passes to the evaluator (e.g. a seed) */
    env: Record<string, unknown>;
    /** seconds since play started, the last frame's duration and the frame number (all 0 outside animation) */
    time: number;
    dt: number;
    frame: number;
}

/** @category Graph */
export type RunFn = (
    inputs: Record<string, any>,
    params: Record<string, any>,
    ctx: RunContext,
) => Record<string, unknown> | void | Promise<Record<string, unknown> | void>;

/** A node type, as declared. @category Graph */
export interface NodeSpec {
    /** unique, e.g. `math/add`; the key nodes are saved with */
    type: string;
    title?: string;
    /** for the add-node menu, e.g. `math` */
    category?: string;
    description?: string;
    inputs?: Record<string, PortSpec>;
    params?: Record<string, ParamSpec>;
    outputs?: Record<string, PortSpec>;
    run: RunFn;
    /**
     * An output node (a viewport, an exporter…): what evaluation is for. By default the
     * evaluator only runs output nodes and what they depend on.
     */
    output?: boolean;
    /**
     * Re-run every frame (with `ctx.time` / `ctx.dt`) while the host animates the graph.
     * The type's default; each node can switch it (`GraphNode.animate`). Default false.
     */
    animate?: boolean;
    /**
     * An equivalent ES module (see {@link compileNodeScript}): a script node's own code, or a
     * built-in's code written out so it can be viewed and forked into a custom node.
     */
    source?: string;
}

/** @category Graph */
export interface Port extends ParsedType, WidgetSpec {
    name: string;
    /** as declared, e.g. `vec2[]` */
    type: string;
    optional: boolean;
    /** accepts several links (list inputs) */
    multi: boolean;
    description?: string;
}

/** @category Graph */
export interface Param extends WidgetSpec {
    name: string;
    type: string;
    description?: string;
}

/** A node type with its ports parsed. @category Graph */
export interface NodeDef {
    readonly type: string;
    readonly title: string;
    readonly category: string;
    readonly description: string;
    readonly inputs: readonly Port[];
    readonly params: readonly Param[];
    readonly outputs: readonly Port[];
    readonly run: RunFn;
    readonly output: boolean;
    readonly animate: boolean;
    readonly source?: string;
    /** bumped whenever a type is re-registered, so cached results are dropped */
    readonly revision: number;
}

let revisionCounter = 0;

function port(name: string, spec: PortSpec): Port {
    const s = typeof spec === 'string' ? { type: spec } : spec;
    if (typeof s.type !== 'string' || !s.type.trim()) throw new Error(`port "${name}": missing type`);
    const parsed = parseType(s.type);
    const multi = !!(s as { multi?: boolean }).multi;
    if (multi && !parsed.list) throw new Error(`port "${name}": only list ports (type[]) can be multi`);
    return { ...s, name, ...parsed, type: s.type.trim(), optional: !!s.optional, multi };
}

/**
 * Checks and normalizes a node spec.
 *
 * @category Graph
 */
export function defineNode(spec: NodeSpec): NodeDef {
    if (!spec || typeof spec.type !== 'string' || !spec.type.trim()) throw new Error('defineNode: `type` is required');
    if (typeof spec.run !== 'function') throw new Error(`node "${spec.type}": \`run\` must be a function`);
    const names = new Set<string>();
    const unique = (n: string, what: string) => {
        if (names.has(`${what}:${n}`)) throw new Error(`node "${spec.type}": duplicate ${what} "${n}"`);
        names.add(`${what}:${n}`);
    };

    const inputs = Object.entries(spec.inputs ?? {}).map(([n, s]) => (unique(n, 'input'), port(n, s)));
    const outputs = Object.entries(spec.outputs ?? {}).map(([n, s]) => (unique(n, 'output'), port(n, s)));
    const params = Object.entries(spec.params ?? {}).map(([n, s]) => {
        unique(n, 'input'); // params and inputs share the node's value map
        if (!s || typeof s.type !== 'string') throw new Error(`node "${spec.type}": param "${n}" needs a type`);
        return { ...s, name: n } as Param;
    });

    const type = spec.type.trim();
    return {
        type,
        title: spec.title ?? type.split('/').pop()!,
        category: spec.category ?? (type.includes('/') ? type.slice(0, type.lastIndexOf('/')) : 'misc'),
        description: spec.description ?? '',
        inputs,
        params,
        outputs,
        run: spec.run,
        output: !!spec.output,
        animate: !!spec.animate,
        source: spec.source,
        revision: ++revisionCounter,
    };
}

/**
 * Node types by name.
 *
 * @category Graph
 */
export class NodeRegistry {
    private readonly defs = new Map<string, NodeDef>();
    private readonly listeners = new Set<(def: NodeDef, removed: boolean) => void>();

    register(spec: NodeSpec | NodeDef): NodeDef {
        const def = 'revision' in spec ? (spec as NodeDef) : defineNode(spec as NodeSpec);
        this.defs.set(def.type, def);
        for (const l of this.listeners) l(def, false);
        return def;
    }

    unregister(type: string): void {
        const def = this.defs.get(type);
        if (!def) return;
        this.defs.delete(type);
        for (const l of this.listeners) l(def, true);
    }

    get(type: string): NodeDef | undefined {
        return this.defs.get(type);
    }

    has(type: string): boolean {
        return this.defs.has(type);
    }

    all(): NodeDef[] {
        return [...this.defs.values()];
    }

    /** Called when a type is registered (or replaced) or removed; returns an unsubscribe. */
    onChange(listener: (def: NodeDef, removed: boolean) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
}
