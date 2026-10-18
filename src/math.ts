/**
 * π, half a turn in radians.
 * @category Math & Random
 */
export const PI = Math.PI;
/**
 * 2π, a full turn in radians.
 * @category Math & Random
 */
export const TAU = Math.PI * 2;
/**
 * π / 2, a quarter turn in radians.
 * @category Math & Random
 */
export const HALF_PI = Math.PI / 2;
/**
 * π / 4, an eighth of a turn in radians.
 * @category Math & Random
 */
export const QUARTER_PI = Math.PI / 4;

/**
 * Euler's number, the base of natural logarithms.
 * @category Math & Random
 */
export const E = Math.E;

/**
 * Multiply degrees by this to get radians.
 * @category Math & Random
 */
export const DEG2RAD = PI / 180;
/**
 * Multiply radians by this to get degrees.
 * @category Math & Random
 */
export const RAD2DEG = 180 / PI;

/**
 * Natural logarithm of 2.
 * @category Math & Random
 */
export const LN2 = Math.LN2;
/**
 * Natural logarithm of 10.
 * @category Math & Random
 */
export const LN10 = Math.LN10;
/**
 * Base-2 logarithm of e.
 * @category Math & Random
 */
export const LOG2E = Math.LOG2E;
/**
 * Base-10 logarithm of e.
 * @category Math & Random
 */
export const LOG10E = Math.LOG10E;

/**
 * Square root of 2.
 * @category Math & Random
 */
export const SQRT2 = Math.SQRT2;
/**
 * Square root of 1/2.
 * @category Math & Random
 */
export const SQRT1_2 = Math.SQRT1_2;

/**
 * `Number.EPSILON` (about 2.2e-16), the default tolerance of {@link nearlyEqual}.
 * @category Math & Random
 */
export const EPSILON = Number.EPSILON;

/**
 * Limits `value` to the inclusive range [`minValue`, `maxValue`].
 * @category Math & Random
 */
export const clamp = (value: number, minValue: number, maxValue: number): number =>
    Math.min(Math.max(value, minValue), maxValue);

/**
 * Clamps `value` to [0, 1].
 * @category Math & Random
 */
export const saturate = (value: number): number =>
    clamp(value, 0, 1);

/**
 * Linearly interpolates from `start` (t = 0) to `end` (t = 1). `t` is not clamped, so values
 * outside [0, 1] extrapolate.
 * @category Math & Random
 */
export const lerp = (start: number, end: number, t: number): number =>
    start + (end - start) * t;

/**
 * The inverse of {@link lerp}: returns the `t` at which `value` lies between `start` and `end`
 * (0 at `start`, 1 at `end`, unclamped). Divides by zero when `start === end`.
 * @category Math & Random
 */
export const inverseLerp = (start: number, end: number, value: number): number =>
    (value - start) / (end - start);

// export const map = (
//     value: number,
//     inMin: number,
//     inMax: number,
//     outMin: number,
//     outMax: number
// ): number =>
//     outMin +
//     ((value - inMin) * (outMax - outMin)) /
//     (inMax - inMin);

/**
 * Hermite smoothstep, as in GLSL: 0 at or below `edge0`, 1 at or above `edge1`, with a smooth
 * S-curve (3t² - 2t³) in between.
 * @category Math & Random
 */
export const smoothstep = (edge0: number, edge1: number, value: number): number => {
    const t = saturate((value - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
};

/**
 * Fractional part of `value`, always in [0, 1) (e.g. `fract(-0.25)` is 0.75).
 * @category Math & Random
 */
export const fract = (value: number): number =>
    value - Math.floor(value);

/**
 * Modulo whose result takes the sign of `divisor` (so `mod(-1, 4)` is 3), unlike JavaScript's `%`.
 * @category Math & Random
 */
export const mod = (value: number, divisor: number): number =>
    ((value % divisor) + divisor) % divisor;

/**
 * Wraps `value` into the half-open range [`minValue`, `maxValue`), e.g. `wrap(370, 0, 360)` is 10.
 * @category Math & Random
 */
export const wrap = (value: number, minValue: number, maxValue: number): number => {
    const range = maxValue - minValue;
    return minValue + mod(value - minValue, range);
};

/**
 * Converts degrees to radians.
 * @category Math & Random
 */
export const radians = (degrees: number): number => degrees * DEG2RAD;
/**
 * Converts radians to degrees.
 * @category Math & Random
 */
export const degrees = (radians: number): number => radians * RAD2DEG;
/**
 * Wraps an angle in radians into [-π, π).
 * @category Math & Random
 */
export const normalizeRadians = (radians: number): number => wrap(radians, -PI, PI);

/**
 * Euclidean distance between (`x1`, `y1`) and (`x2`, `y2`).
 * @category Math & Random
 */
export const distance2d = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
): number => Math.hypot(x2 - x1, y2 - y1);

/**
 * Euclidean distance between (`x1`, `y1`, `z1`) and (`x2`, `y2`, `z2`).
 * @category Math & Random
 */
export const distance3d = (
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number
): number => Math.hypot(x2 - x1, y2 - y1, z2 - z1);

/**
 * Squared 2D Euclidean distance; cheaper than {@link distance2d} when only comparing distances.
 * @category Math & Random
 */
export const squaredDistance = (
    x1: number,
    y1: number,
    x2: number,
    y2: number
): number => {
    const dx = x2 - x1;
    const dy = y2 - y1;

    return dx * dx + dy * dy;
};

/**
 * 2D Manhattan (taxicab) distance: `|dx| + |dy|`.
 * @category Math & Random
 */
export const manhattanDistance = (
    x1: number,
    y1: number,
    x2: number,
    y2: number
): number =>
    Math.abs(x2 - x1) + Math.abs(y2 - y1);

/**
 * True when `a` and `b` differ by at most `epsilon` (an absolute tolerance, default
 * {@link EPSILON}, which is very strict for values far from 1).
 * @category Math & Random
 */
export const nearlyEqual = (
    a: number,
    b: number,
    epsilon = EPSILON
): boolean =>
    Math.abs(a - b) <= epsilon;

/**
 * Rounds `value` to `digits` decimal places (default 0); negative `digits` round to tens,
 * hundreds, etc.
 * @category Math & Random
 */
export const roundTo = (
    value: number,
    digits = 0
): number => {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
};

/**
 * Deterministic 32-bit integer hash (the MurmurHash3 finalizer). `n` is truncated to a 32-bit
 * integer first.
 * @returns an unsigned 32-bit integer in [0, 2³²)
 * @category Math & Random
 */
export const hash32 = (n: number): number => {
    n |= 0;

    n ^= n >>> 16;
    n = Math.imul(n, 0x85ebca6b);

    n ^= n >>> 13;
    n = Math.imul(n, 0xc2b2ae35);

    n ^= n >>> 16;

    return n >>> 0;
};

/**
 * Deterministically hashes any number of values (each truncated to a 32-bit integer) into one
 * unsigned 32-bit integer by folding them through {@link hash32}. Order matters; no values gives 0.
 * @category Math & Random
 */
export const hash32mix = (...values: number[]): number => {
    let n = 0;

    for (const value of values) {
        n ^= value | 0;
        n = hash32(n);
    }

    return n;
};
