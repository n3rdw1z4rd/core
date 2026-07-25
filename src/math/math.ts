// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

export const PI = Math.PI;
export const TAU = Math.PI * 2;
export const HALF_PI = Math.PI / 2;
export const QUARTER_PI = Math.PI / 4;

export const E = Math.E;

export const DEG2RAD = PI / 180;
export const RAD2DEG = 180 / PI;

export const LN2 = Math.LN2;
export const LN10 = Math.LN10;
export const LOG2E = Math.LOG2E;
export const LOG10E = Math.LOG10E;

export const SQRT2 = Math.SQRT2;
export const SQRT1_2 = Math.SQRT1_2;

export const EPSILON = Number.EPSILON;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface XY {
    readonly x: number;
    readonly y: number;
}

export interface XYZ {
    readonly x: number;
    readonly y: number;
    readonly z: number;
}

export interface XYZW {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly w: number;
}

export interface RGB {
    readonly r: number;
    readonly g: number;
    readonly b: number;
}

export interface RGBA {
    readonly r: number;
    readonly g: number;
    readonly b: number;
    readonly a: number;
}

// -----------------------------------------------------------------------------
// Basic math
// -----------------------------------------------------------------------------

export const abs = Math.abs;
export const min = Math.min;
export const max = Math.max;

export const floor = Math.floor;
export const ceil = Math.ceil;
export const round = Math.round;
export const trunc = Math.trunc;

export const sign = Math.sign;

export const sqrt = Math.sqrt;
export const cbrt = Math.cbrt;

export const pow = Math.pow;

export const exp = Math.exp;
export const expm1 = Math.expm1;

export const log = Math.log;
export const log1p = Math.log1p;
export const log2 = Math.log2;
export const log10 = Math.log10;

export const hypot = Math.hypot;

export const imul = Math.imul;

// -----------------------------------------------------------------------------
// Trigonometry
// -----------------------------------------------------------------------------

export const sin = Math.sin;
export const cos = Math.cos;
export const tan = Math.tan;

export const asin = Math.asin;
export const acos = Math.acos;
export const atan = Math.atan;
export const atan2 = Math.atan2;

export const sinh = Math.sinh;
export const cosh = Math.cosh;
export const tanh = Math.tanh;

// -----------------------------------------------------------------------------
// Utility
// -----------------------------------------------------------------------------

export const clamp = (
    value: number,
    minValue: number,
    maxValue: number
): number => min(max(value, minValue), maxValue);

export const saturate = (value: number): number =>
    clamp(value, 0, 1);

export const lerp = (
    start: number,
    end: number,
    t: number
): number =>
    start + (end - start) * t;

export const inverseLerp = (
    start: number,
    end: number,
    value: number
): number =>
    (value - start) / (end - start);

export const map = (
    value: number,
    inMin: number,
    inMax: number,
    outMin: number,
    outMax: number
): number =>
    outMin +
    ((value - inMin) * (outMax - outMin)) /
    (inMax - inMin);

export const smoothstep = (
    edge0: number,
    edge1: number,
    value: number
): number => {
    const t = saturate((value - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
};

export const fract = (value: number): number =>
    value - floor(value);

export const mod = (
    value: number,
    divisor: number
): number =>
    ((value % divisor) + divisor) % divisor;

export const wrap = (
    value: number,
    minValue: number,
    maxValue: number
): number => {
    const range = maxValue - minValue;
    return minValue + mod(value - minValue, range);
};

// -----------------------------------------------------------------------------
// Angle
// -----------------------------------------------------------------------------

export const radians = (
    degrees: number
): number =>
    degrees * DEG2RAD;

export const degrees = (
    radians: number
): number =>
    radians * RAD2DEG;

export const normalizeRadians = (
    radians: number
): number =>
    wrap(radians, -PI, PI);

// -----------------------------------------------------------------------------
// Distance
// -----------------------------------------------------------------------------

export const hypot2 = (
    x: number,
    y: number
): number =>
    hypot(x, y);

export const hypot3 = (
    x: number,
    y: number,
    z: number
): number =>
    hypot(x, y, z);

export const distance2d = (
    x1: number,
    y1: number,
    x2: number,
    y2: number
): number =>
    hypot(x2 - x1, y2 - y1);

export const distance3d = (
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number
): number =>
    hypot(
        x2 - x1,
        y2 - y1,
        z2 - z1
    );

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

export const manhattanDistance = (
    x1: number,
    y1: number,
    x2: number,
    y2: number
): number =>
    abs(x2 - x1) + abs(y2 - y1);

// -----------------------------------------------------------------------------
// Comparison
// -----------------------------------------------------------------------------

export const nearlyEqual = (
    a: number,
    b: number,
    epsilon = EPSILON
): boolean =>
    abs(a - b) <= epsilon;

// -----------------------------------------------------------------------------
// Rounding
// -----------------------------------------------------------------------------

export const roundTo = (
    value: number,
    digits = 0
): number => {
    const factor = 10 ** digits;
    return round(value * factor) / factor;
};

// -----------------------------------------------------------------------------
// Misc.
// -----------------------------------------------------------------------------

export const isFinite = Number.isFinite;
export const isInteger = Number.isInteger;
export const isNaN = Number.isNaN;
