import { Rng } from '../rng';
import { NodeRegistry, type NodeSpec } from './node';
import { BUILTIN_SOURCES } from './sources';

/**
 * General-purpose built-in nodes: values, math, vectors and lists. Domain nodes (shapes,
 * bodies, scenes, viewports) belong to the app that runs the graph.
 *
 * @module
 */

type Vec2 = { x: number; y: number };
const v2 = (x = 0, y = 0): Vec2 => ({ x, y });
const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** @category Graph */
export const BUILTIN_NODES: NodeSpec[] = [
    /* ── values ─────────────────────────────────────────────── */
    {
        type: 'value/number',
        title: 'Number',
        params: { value: { type: 'number', default: 0 } },
        outputs: { value: 'number' },
        run: (_, { value }) => ({ value: num(value) }),
    },
    {
        type: 'value/vec2',
        title: 'Vec2',
        inputs: { x: { type: 'number', default: 0 }, y: { type: 'number', default: 0 } },
        outputs: { vec: 'vec2' },
        run: ({ x, y }) => ({ vec: v2(num(x), num(y)) }),
    },
    {
        type: 'value/color',
        title: 'Color',
        params: { color: { type: 'color', default: '#3fd1a4' } },
        outputs: { color: 'color' },
        run: (_, { color }) => ({ color }),
    },
    {
        type: 'value/text',
        title: 'Text',
        params: { text: { type: 'string', default: '' } },
        outputs: { text: 'string' },
        run: (_, { text }) => ({ text: String(text ?? '') }),
    },

    {
        type: 'value/time',
        title: 'Time',
        description: 'the animation clock (animates by default)',
        animate: true,
        params: { speed: { type: 'number', default: 1, step: 0.1 } },
        outputs: { time: 'number', dt: 'number', frame: 'number' },
        run: (_, { speed }, ctx) => ({ time: ctx.time * num(speed, 1), dt: ctx.dt * num(speed, 1), frame: ctx.frame }),
    },
    {
        type: 'math/wave',
        title: 'Wave',
        description: 'sin / triangle / square / saw of t',
        inputs: { t: { type: 'number', default: 0 }, period: { type: 'number', default: 1 }, amplitude: { type: 'number', default: 1 } },
        params: { shape: { type: 'enum', options: ['sine', 'triangle', 'square', 'saw'], default: 'sine' } },
        outputs: { value: 'number' },
        run: ({ t, period, amplitude }, { shape }) => {
            const p = num(t) / (num(period, 1) || 1);
            const f = p - Math.floor(p);
            const w: Record<string, number> = {
                sine: Math.sin(p * Math.PI * 2), triangle: 1 - 4 * Math.abs(f - 0.5), square: f < 0.5 ? 1 : -1, saw: f * 2 - 1,
            };
            return { value: (w[shape] ?? w.sine) * num(amplitude, 1) };
        },
    },

    /* ── math ───────────────────────────────────────────────── */
    {
        type: 'math/math',
        title: 'Math',
        description: 'a ⊕ b for the chosen operation',
        inputs: { a: { type: 'number', default: 0 }, b: { type: 'number', default: 0 } },
        params: { op: { type: 'enum', options: ['+', '−', '×', '÷', 'min', 'max', 'pow', 'mod'], default: '+' } },
        outputs: { result: 'number' },
        run: ({ a, b }, { op }) => {
            const x = num(a);
            const y = num(b);
            const r: Record<string, number> = {
                '+': x + y, '−': x - y, '×': x * y, '÷': y === 0 ? 0 : x / y,
                min: Math.min(x, y), max: Math.max(x, y), pow: x ** y, mod: y === 0 ? 0 : ((x % y) + y) % y,
            };
            return { result: r[op] ?? x + y };
        },
    },
    {
        type: 'math/remap',
        title: 'Remap',
        inputs: {
            value: { type: 'number', default: 0.5 },
            inMin: { type: 'number', default: 0 }, inMax: { type: 'number', default: 1 },
            outMin: { type: 'number', default: 0 }, outMax: { type: 'number', default: 100 },
        },
        params: { clamp: { type: 'boolean', default: false } },
        outputs: { result: 'number' },
        run: ({ value, inMin, inMax, outMin, outMax }, { clamp }) => {
            let t = inMax === inMin ? 0 : (value - inMin) / (inMax - inMin);
            if (clamp) t = Math.min(1, Math.max(0, t));
            return { result: outMin + (outMax - outMin) * t };
        },
    },

    /* ── vectors ────────────────────────────────────────────── */
    {
        type: 'vec2/split',
        title: 'Split Vec2',
        inputs: { vec: 'vec2' },
        outputs: { x: 'number', y: 'number' },
        run: ({ vec }) => ({ x: num(vec?.x), y: num(vec?.y) }),
    },
    {
        type: 'vec2/offset',
        title: 'Offset',
        description: 'vec + by',
        inputs: { vec: 'vec2', by: { type: 'vec2', default: { x: 0, y: 0 } } },
        outputs: { vec: 'vec2' },
        run: ({ vec, by }) => ({ vec: v2(num(vec?.x) + num(by?.x), num(vec?.y) + num(by?.y)) }),
    },

    /* ── lists ──────────────────────────────────────────────── */
    {
        type: 'list/range',
        title: 'Range',
        description: 'numbers from start (inclusive) to end (exclusive)',
        inputs: { start: { type: 'number', default: 0 }, end: { type: 'number', default: 10 }, step: { type: 'number', default: 1 } },
        outputs: { numbers: 'number[]' },
        run: ({ start, end, step }) => {
            const s = num(step, 1) || 1;
            const out: number[] = [];
            for (let v = num(start); s > 0 ? v < end : v > end; v += s) {
                out.push(v);
                if (out.length >= 100_000) break;
            }
            return { numbers: out };
        },
    },
    {
        type: 'list/grid2d',
        title: 'Grid',
        description: 'points on a grid, centered on `center`; stagger shifts every other row by half a cell',
        inputs: {
            cols: { type: 'number', default: 5, min: 1, step: 1 },
            rows: { type: 'number', default: 5, min: 1, step: 1 },
            spacing: { type: 'vec2', default: { x: 32, y: 32 } },
            center: { type: 'vec2', default: { x: 0, y: 0 } },
        },
        params: { stagger: { type: 'boolean', default: false } },
        outputs: { points: 'vec2[]' },
        run: ({ cols, rows, spacing, center }, { stagger }) => {
            const c = Math.max(0, Math.min(1000, Math.floor(num(cols))));
            const r = Math.max(0, Math.min(1000, Math.floor(num(rows))));
            const sx = num(spacing?.x, 32);
            const sy = num(spacing?.y, 32);
            const points: Vec2[] = [];
            for (let j = 0; j < r; j++) {
                const shift = stagger && j % 2 === 1 ? sx / 2 : 0;
                for (let i = 0; i < c; i++) {
                    points.push(v2(num(center?.x) + (i - (c - 1) / 2) * sx + shift, num(center?.y) + ((r - 1) / 2 - j) * sy));
                }
            }
            return { points };
        },
    },
    {
        type: 'list/random',
        title: 'Random',
        description: 'seeded random numbers in [min, max)',
        inputs: {
            count: { type: 'number', default: 10, min: 0, step: 1 },
            min: { type: 'number', default: 0 },
            max: { type: 'number', default: 1 },
            seed: { type: 'number', default: 1, step: 1 },
        },
        outputs: { numbers: 'number[]' },
        run: ({ count, min, max, seed }) => {
            const rng = new Rng(num(seed, 1));
            const n = Math.max(0, Math.min(100_000, Math.floor(num(count))));
            return { numbers: Array.from({ length: n }, () => num(min) + rng.nextFloat() * (num(max, 1) - num(min))) };
        },
    },
    {
        type: 'list/count',
        title: 'Count',
        inputs: { list: 'any[]' },
        outputs: { count: 'number' },
        run: ({ list }) => ({ count: list.length }),
    },
    {
        type: 'list/merge',
        title: 'Merge',
        description: 'joins every list wired in, in order',
        inputs: { lists: { type: 'any[]', multi: true, optional: true } },
        outputs: { list: 'any[]' },
        run: ({ lists }) => ({ list: [...(lists ?? [])] }),
    },
    {
        type: 'list/pick',
        title: 'Pick',
        description: 'every nth item from a list',
        inputs: { list: 'any[]', every: { type: 'number', default: 2, min: 1, step: 1 }, offset: { type: 'number', default: 0, step: 1 } },
        outputs: { list: 'any[]' },
        run: ({ list, every, offset }) => {
            const n = Math.max(1, Math.floor(num(every, 1)));
            return { list: list.filter((_: unknown, i: number) => (i - Math.floor(num(offset))) % n === 0 && i >= num(offset)) };
        },
    },
];

/**
 * A registry with the built-in nodes.
 *
 * @category Graph
 */
export function createNodeRegistry(): NodeRegistry {
    const registry = new NodeRegistry();
    // each built-in carries its source (a script module) so it can be viewed and forked
    for (const spec of BUILTIN_NODES) registry.register({ ...spec, source: spec.source ?? BUILTIN_SOURCES[spec.type] });
    return registry;
}
