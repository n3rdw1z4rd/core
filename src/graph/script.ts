import { defineNode, type NodeDef, type NodeSpec } from './node';

/**
 * Script nodes: a node type written as a plain ES module, compiled at runtime.
 *
 * ```js
 * export const title = 'Lerp';                       // optional: title, category, description, output, animate
 * export const inputs = { a: 'number', b: { type: 'number', default: 1 } };
 * export const params = { t: { type: 'number', default: 0.5, min: 0, max: 1, step: 0.05 } };
 * export const outputs = { value: 'number' };
 * export function run({ a, b }, { t }, ctx) {
 *     return { value: a + (b - a) * t };
 * }
 * ```
 *
 * The module is imported from a `data:` URL, which works in browsers, workers and Node.
 * It runs with the page's (or worker's) privileges — treat shared scripts as untrusted and
 * evaluate them in a worker.
 *
 * @module
 */

/**
 * Another shape of script module a host understands, besides `run` nodes: a module that exports
 * no `run` but any of `hooks` is compiled into a node with this `run` (and these outputs and
 * category, unless the module declares its own). What the hooks mean is up to the host — e.g. a
 * per-frame `update` it calls later: `run` typically packs the node's params and `ctx.source`
 * into a value the host picks up from the output.
 *
 * ```ts
 * const agent: ModuleKind = {
 *     hooks: ['update'],
 *     outputs: { agent: 'agent' },
 *     run: (inputs, params, ctx) => ({ agent: { params: { ...inputs, ...params }, source: ctx.source } }),
 * };
 * const def = await compileNodeScript('agents/wander', source, { kinds: [agent] });
 * ```
 *
 * @category Graph
 */
export interface ModuleKind {
    /** exporting any of these (and no `run`) makes a module this kind */
    hooks: readonly string[];
    /** the node's run */
    run: NodeSpec['run'];
    /** outputs, unless the module exports its own */
    outputs?: NodeSpec['outputs'];
    /** category, unless the module exports its own */
    category?: string;
}

/** @category Graph */
export interface ScriptOptions {
    /** the module kinds this host understands besides `run` nodes (first match wins) */
    kinds?: readonly ModuleKind[];
}

/**
 * Compiles a script node's source into a node type named `type`.
 *
 * @category Graph
 */
export async function compileNodeScript(type: string, source: string, options: ScriptOptions = {}): Promise<NodeDef> {
    const url = `data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`;
    const mod = await import(/* @vite-ignore */ url);
    const m = { ...(mod.default && typeof mod.default === 'object' && !mod.run ? mod.default : mod) } as Partial<NodeSpec> & Record<string, unknown>;
    if (typeof m.run !== 'function') {
        // another kind of module the host understands: hooks instead of run
        const kind = options.kinds?.find((k) => k.hooks.some((h) => typeof m[h] === 'function'));
        if (kind) {
            m.run = kind.run;
            m.outputs ??= kind.outputs;
            m.category ??= kind.category;
        }
    }
    if (typeof m.run !== 'function') {
        const hooks = options.kinds?.flatMap((k) => k.hooks) ?? [];
        throw new Error(`script node "${type}": export a run(inputs, params, ctx) function${hooks.length ? ` (or ${hooks.join(' / ')})` : ''}`);
    }
    return defineNode({
        type,
        title: m.title,
        category: m.category ?? 'scripts',
        description: m.description,
        inputs: m.inputs,
        params: m.params,
        outputs: m.outputs,
        output: m.output,
        animate: m.animate,
        run: m.run,
        source,
    });
}

/** A starting point for a new script node. @category Graph */
export const SCRIPT_NODE_TEMPLATE = `// A node is a function with a typed interface.
// inputs: pins wired from other nodes (an unconnected one uses its widget value / default)
// params: widgets on the node
// outputs: what run() returns
// A "type[]" pin takes (or gives) a whole list; a list wired into a plain pin runs
// run() once per item and collects the results into lists.

export const inputs = {
    a: { type: 'number', default: 1 },
    b: { type: 'number', default: 2 },
};

export const params = {
    scale: { type: 'number', default: 1, min: 0, max: 10, step: 0.1 },
};

export const outputs = {
    result: 'number',
};

export function run({ a, b }, { scale }, ctx) {
    return { result: (a + b) * scale };
}
`;
