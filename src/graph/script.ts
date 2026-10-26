import { defineNode, type NodeDef, type NodeSpec } from './node';

/**
 * Script nodes: a node type written as a plain ES module, compiled at runtime.
 *
 * ```js
 * export const title = 'Ball';                       // optional: title, category, description, output, animate
 * export const inputs = { at: 'vec2', radius: { type: 'number', default: 8 } };
 * export const params = { color: { type: 'color', default: '#e8554e' } };
 * export const outputs = { entity: 'entity' };
 * export function run({ at, radius }, { color }, ctx) {
 *     return { entity: { shape: 'ball', x: at.x, y: at.y, r: radius, color } };
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
 * Compiles a script node's source into a node type named `type`.
 *
 * @category Graph
 */
export async function compileNodeScript(type: string, source: string): Promise<NodeDef> {
    const url = `data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`;
    const mod = await import(/* @vite-ignore */ url);
    const m = (mod.default && typeof mod.default === 'object' && !mod.run ? mod.default : mod) as Partial<NodeSpec>;
    if (typeof m.run !== 'function') throw new Error(`script node "${type}": export a run(inputs, params, ctx) function`);
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
