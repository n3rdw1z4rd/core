/**
 * The built-in nodes as script modules: the same interface and behaviour as the TypeScript
 * definitions in `nodes.ts`, written self-contained so the editor can show a built-in's code
 * and fork it into a custom node. A test compiles each one and checks it matches.
 *
 * @module
 */

const num = `const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);`;

/** @category Graph */
export const BUILTIN_SOURCES: Record<string, string> = {
    'value/number': `export const title = 'Number';
export const params = { value: { type: 'number', default: 0 } };
export const outputs = { value: 'number' };

${num}

export function run(inputs, { value }) {
    return { value: num(value) };
}
`,

    'value/vec2': `export const title = 'Vec2';
export const inputs = {
    x: { type: 'number', default: 0 },
    y: { type: 'number', default: 0 },
};
export const outputs = { vec: 'vec2' };

${num}

export function run({ x, y }) {
    return { vec: { x: num(x), y: num(y) } };
}
`,

    'value/color': `export const title = 'Color';
export const params = { color: { type: 'color', default: '#3fd1a4' } };
export const outputs = { color: 'color' };

export function run(inputs, { color }) {
    return { color };
}
`,

    'value/text': `export const title = 'Text';
export const params = { text: { type: 'string', default: '' } };
export const outputs = { text: 'string' };

export function run(inputs, { text }) {
    return { text: String(text ?? '') };
}
`,

    'value/time': `export const title = 'Time';
export const description = 'the animation clock (animates by default)';
export const animate = true;
export const params = { speed: { type: 'number', default: 1, step: 0.1 } };
export const outputs = { time: 'number', dt: 'number', frame: 'number' };

${num}

export function run(inputs, { speed }, ctx) {
    return { time: ctx.time * num(speed, 1), dt: ctx.dt * num(speed, 1), frame: ctx.frame };
}
`,

    'math/wave': `export const title = 'Wave';
export const description = 'sin / triangle / square / saw of t';
export const inputs = {
    t: { type: 'number', default: 0 },
    period: { type: 'number', default: 1 },
    amplitude: { type: 'number', default: 1 },
};
export const params = { shape: { type: 'enum', options: ['sine', 'triangle', 'square', 'saw'], default: 'sine' } };
export const outputs = { value: 'number' };

${num}

export function run({ t, period, amplitude }, { shape }) {
    const p = num(t) / (num(period, 1) || 1);
    const f = p - Math.floor(p);
    const waves = {
        sine: Math.sin(p * Math.PI * 2),
        triangle: 1 - 4 * Math.abs(f - 0.5),
        square: f < 0.5 ? 1 : -1,
        saw: f * 2 - 1,
    };
    return { value: (waves[shape] ?? waves.sine) * num(amplitude, 1) };
}
`,

    'math/math': `export const title = 'Math';
export const description = 'a ⊕ b for the chosen operation';
export const inputs = {
    a: { type: 'number', default: 0 },
    b: { type: 'number', default: 0 },
};
export const params = { op: { type: 'enum', options: ['+', '−', '×', '÷', 'min', 'max', 'pow', 'mod'], default: '+' } };
export const outputs = { result: 'number' };

${num}

export function run({ a, b }, { op }) {
    const x = num(a);
    const y = num(b);
    const results = {
        '+': x + y, '−': x - y, '×': x * y, '÷': y === 0 ? 0 : x / y,
        min: Math.min(x, y), max: Math.max(x, y), pow: x ** y, mod: y === 0 ? 0 : ((x % y) + y) % y,
    };
    return { result: results[op] ?? x + y };
}
`,

    'math/remap': `export const title = 'Remap';
export const inputs = {
    value: { type: 'number', default: 0.5 },
    inMin: { type: 'number', default: 0 },
    inMax: { type: 'number', default: 1 },
    outMin: { type: 'number', default: 0 },
    outMax: { type: 'number', default: 100 },
};
export const params = { clamp: { type: 'boolean', default: false } };
export const outputs = { result: 'number' };

export function run({ value, inMin, inMax, outMin, outMax }, { clamp }) {
    let t = inMax === inMin ? 0 : (value - inMin) / (inMax - inMin);
    if (clamp) t = Math.min(1, Math.max(0, t));
    return { result: outMin + (outMax - outMin) * t };
}
`,

    'vec2/split': `export const title = 'Split Vec2';
export const inputs = { vec: 'vec2' };
export const outputs = { x: 'number', y: 'number' };

${num}

export function run({ vec }) {
    return { x: num(vec?.x), y: num(vec?.y) };
}
`,

    'vec2/offset': `export const title = 'Offset';
export const description = 'vec + by';
export const inputs = {
    vec: 'vec2',
    by: { type: 'vec2', default: { x: 0, y: 0 } },
};
export const outputs = { vec: 'vec2' };

${num}

export function run({ vec, by }) {
    return { vec: { x: num(vec?.x) + num(by?.x), y: num(vec?.y) + num(by?.y) } };
}
`,

    'list/range': `export const title = 'Range';
export const description = 'numbers from start (inclusive) to end (exclusive)';
export const inputs = {
    start: { type: 'number', default: 0 },
    end: { type: 'number', default: 10 },
    step: { type: 'number', default: 1 },
};
export const outputs = { numbers: 'number[]' };

${num}

export function run({ start, end, step }) {
    const s = num(step, 1) || 1;
    const numbers = [];
    for (let v = num(start); s > 0 ? v < end : v > end; v += s) {
        numbers.push(v);
        if (numbers.length >= 100000) break;
    }
    return { numbers };
}
`,

    'list/grid2d': `export const title = 'Grid';
export const description = 'points on a grid, centered on \`center\`; stagger shifts every other row by half a cell';
export const inputs = {
    cols: { type: 'number', default: 5, min: 1, step: 1 },
    rows: { type: 'number', default: 5, min: 1, step: 1 },
    spacing: { type: 'vec2', default: { x: 32, y: 32 } },
    center: { type: 'vec2', default: { x: 0, y: 0 } },
};
export const params = { stagger: { type: 'boolean', default: false } };
export const outputs = { points: 'vec2[]' };

${num}

export function run({ cols, rows, spacing, center }, { stagger }) {
    const c = Math.max(0, Math.min(1000, Math.floor(num(cols))));
    const r = Math.max(0, Math.min(1000, Math.floor(num(rows))));
    const sx = num(spacing?.x, 32);
    const sy = num(spacing?.y, 32);
    const points = [];
    for (let j = 0; j < r; j++) {
        const shift = stagger && j % 2 === 1 ? sx / 2 : 0;
        for (let i = 0; i < c; i++) {
            points.push({ x: num(center?.x) + (i - (c - 1) / 2) * sx + shift, y: num(center?.y) + ((r - 1) / 2 - j) * sy });
        }
    }
    return { points };
}
`,

    'list/random': `export const title = 'Random';
export const description = 'seeded random numbers in [min, max)';
export const inputs = {
    count: { type: 'number', default: 10, min: 0, step: 1 },
    min: { type: 'number', default: 0 },
    max: { type: 'number', default: 1 },
    seed: { type: 'number', default: 1, step: 1 },
};
export const outputs = { numbers: 'number[]' };

${num}

// the same generator as @n3rdw1z4rd/core's Rng: a 32-bit hash of an incrementing seed
const hash32 = (n) => {
    n |= 0;
    n ^= n >>> 16;
    n = Math.imul(n, 0x85ebca6b);
    n ^= n >>> 13;
    n = Math.imul(n, 0xc2b2ae35);
    n ^= n >>> 16;
    return n >>> 0;
};

export function run({ count, min, max, seed }) {
    let s = num(seed, 1) | 0;
    const next = () => hash32((s++) | 0) / 0x100000000;
    const n = Math.max(0, Math.min(100000, Math.floor(num(count))));
    return { numbers: Array.from({ length: n }, () => num(min) + next() * (num(max, 1) - num(min))) };
}
`,

    'list/count': `export const title = 'Count';
export const inputs = { list: 'any[]' };
export const outputs = { count: 'number' };

export function run({ list }) {
    return { count: list.length };
}
`,

    'list/merge': `export const title = 'Merge';
export const description = 'joins every list wired in, in order';
export const inputs = { lists: { type: 'any[]', multi: true, optional: true } };
export const outputs = { list: 'any[]' };

export function run({ lists }) {
    return { list: [...(lists ?? [])] };
}
`,

    'list/pick': `export const title = 'Pick';
export const description = 'every nth item from a list';
export const inputs = {
    list: 'any[]',
    every: { type: 'number', default: 2, min: 1, step: 1 },
    offset: { type: 'number', default: 0, step: 1 },
};
export const outputs = { list: 'any[]' };

${num}

export function run({ list, every, offset }) {
    const n = Math.max(1, Math.floor(num(every, 1)));
    return { list: list.filter((_, i) => (i - Math.floor(num(offset))) % n === 0 && i >= num(offset)) };
}
`,
};
