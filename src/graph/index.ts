/**
 * Node graphs: a graph document format, typed pins, node types (built-in or written as
 * scripts), and a lazy, memoized evaluator with list broadcasting. No DOM: runs in a page,
 * a worker or Node.
 *
 * ```ts
 * import { createGraph, createNodeRegistry, addNode, connect, GraphEvaluator } from '@n3rdw1z4rd/core/graph';
 *
 * const nodes = createNodeRegistry();
 * const graph = createGraph();
 * const grid = addNode(graph, nodes.get('list/grid2d')!, [0, 0], { cols: 3, rows: 2 });
 * const count = addNode(graph, nodes.get('list/count')!, [240, 0]);
 * connect(graph, nodes, { node: grid.id, port: 'points' }, { node: count.id, port: 'list' });
 *
 * const { results } = await new GraphEvaluator(nodes).evaluate(graph);
 * results.get(count.id)!.outputs.count; // 6
 * ```
 *
 * @packageDocumentation
 * @module @n3rdw1z4rd/core/graph
 */
export * from './doc';
export * from './evaluate';
export * from './node';
export * from './nodes';
export * from './script';
export * from './types';
