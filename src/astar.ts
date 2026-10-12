import { Heap } from 'heap-js';
import { SQRT2 } from './math';
import type { XY } from './types';

/**
 * Cost of stepping onto tile (x, y). Return `Infinity` for blocked tiles. Costs should be >= 1
 * (the heuristic assumes it); use larger values for slower terrain or occupied tiles.
 */
export type StepCost = (x: number, y: number) => number;

export interface PathOptions {
    diagonal?: boolean,   // 8-way movement; a diagonal step costs SQRT2 * the tile's cost. Default false.
    cutCorners?: boolean, // allow a diagonal step past a blocked orthogonal neighbour. Default false.
    adjacent?: boolean,   // stop on a tile next to the goal (the goal itself may be blocked). Default false.
    maxNodes?: number,    // give up after expanding this many tiles. Default 10,000.
    partial?: boolean,    // if the goal isn't reached, return the path to the closest tile found. Default false.
}

const DEFAULT_MAX_NODES = 10_000;

// up, right, down, left, then the diagonals
const DIRECTIONS: readonly (readonly [number, number])[] = [
    [0, -1], [1, 0], [0, 1], [-1, 0],
    [1, -1], [1, 1], [-1, 1], [-1, -1],
];

// numeric keys: about ±33 million per axis, still within Number.MAX_SAFE_INTEGER
const KEY_OFFSET = 0x2000000;
const KEY_BASE = 0x4000000;
const key = (x: number, y: number): number => (x + KEY_OFFSET) * KEY_BASE + (y + KEY_OFFSET);

interface Node {
    x: number,
    y: number,
    g: number,     // cost from start
    h: number,     // heuristic to goal
    f: number,     // g + h
    seq: number,   // insertion order, for deterministic tie-breaking
    parent?: Node,
}

/**
 * Finds a lowest-cost path on an unbounded grid with A*.
 *
 * The returned path excludes `start` and ends on the goal (or, with `adjacent`, on a tile next to
 * it). Returns [] if `start` already satisfies the goal, or if no path is found (unless `partial`).
 * The same inputs always produce the same path.
 */
export function findPath(start: XY, goal: XY, cost: StepCost, options: PathOptions = {}): XY[] {
    const diagonal = options.diagonal ?? false;
    const cutCorners = options.cutCorners ?? false;
    const adjacent = options.adjacent ?? false;
    const maxNodes = options.maxNodes ?? DEFAULT_MAX_NODES;
    const partial = options.partial ?? false;

    const directions = diagonal ? DIRECTIONS : DIRECTIONS.slice(0, 4);

    // Manhattan for 4-way, octile for 8-way: never overestimates when step costs are >= 1
    const heuristic = (x: number, y: number): number => {
        const dx = Math.abs(x - goal.x);
        const dy = Math.abs(y - goal.y);

        return diagonal
            ? Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy)
            : dx + dy;
    };

    const isGoal = (x: number, y: number): boolean => {
        if (x === goal.x && y === goal.y) return true;
        if (!adjacent) return false;

        const dx = Math.abs(x - goal.x);
        const dy = Math.abs(y - goal.y);

        return diagonal ? Math.max(dx, dy) === 1 : dx + dy === 1;
    };

    const passable = (x: number, y: number): boolean => cost(x, y) < Infinity;

    // a blocked goal can never be reached; skip the search unless the closest tile is wanted
    if (!adjacent && !partial && !passable(goal.x, goal.y) && !(start.x === goal.x && start.y === goal.y)) {
        return [];
    }

    let seq = 0;

    // lowest f first; ties go to the node closer to the goal, then to the earliest inserted
    const open = new Heap<Node>((a, b) => (a.f - b.f) || (a.h - b.h) || (a.seq - b.seq));
    const best = new Map<number, Node>(); // cheapest known node per tile
    const closed = new Set<number>();

    const startNode: Node = { x: start.x, y: start.y, g: 0, h: heuristic(start.x, start.y), f: 0, seq: seq++ };
    startNode.f = startNode.h;

    open.push(startNode);
    best.set(key(start.x, start.y), startNode);

    let closest = startNode;
    let expanded = 0;

    while (open.length > 0 && expanded < maxNodes) {
        const current = open.pop()!;
        const currentKey = key(current.x, current.y);

        // stale entry: this tile was already expanded via a cheaper route
        if (closed.has(currentKey)) continue;

        if (isGoal(current.x, current.y)) {
            return buildPath(current);
        }

        closed.add(currentKey);
        expanded++;

        if (current.h < closest.h || (current.h === closest.h && current.g < closest.g)) {
            closest = current;
        }

        for (let d = 0; d < directions.length; d++) {
            const [dx, dy] = directions[d];
            const x = current.x + dx;
            const y = current.y + dy;
            const k = key(x, y);

            if (closed.has(k)) continue;

            const stepCost = cost(x, y);

            if (!(stepCost < Infinity)) continue;

            const isDiagonal = dx !== 0 && dy !== 0;

            // don't squeeze diagonally between two blocked tiles or clip a wall corner
            if (isDiagonal && !cutCorners && (!passable(current.x + dx, current.y) || !passable(current.x, current.y + dy))) {
                continue;
            }

            const g = current.g + (isDiagonal ? stepCost * SQRT2 : stepCost);
            const known = best.get(k);

            if (known && known.g <= g) continue;

            const h = known?.h ?? heuristic(x, y);
            const node: Node = { x, y, g, h, f: g + h, seq: seq++, parent: current };

            best.set(k, node);
            open.push(node); // a superseded entry for this tile is skipped when popped
        }
    }

    return partial ? buildPath(closest) : [];
}

function buildPath(end: Node): XY[] {
    const path: XY[] = [];

    for (let node: Node | undefined = end; node?.parent; node = node.parent) {
        path.push({ x: node.x, y: node.y });
    }

    return path.reverse();
}
