/** Ratio of a circle's circumference to its diameter, to double precision. */
export const PI = 3.14159265358979323846;
/** `2 * PI` - a full turn in radians. */
export const DOUBLE_PI = PI * 2;
/** `PI / 2` - a quarter turn in radians. */
export const HALF_PI = PI / 2;
/** Multiplier that converts degrees to radians (`degrees * RADIAN_FACTOR`). */
export const RADIAN_FACTOR = PI / 180.0;

/** A readonly 2D point or size. */
export interface XY {
    readonly x: number,
    readonly y: number,
}

/** A readonly 3D point or size. */
export interface XYZ {
    readonly x: number,
    readonly y: number,
    readonly z: number,
}

/** A readonly quaternion or homogeneous 3D point/size. */
export interface XYZW {
    readonly x: number,
    readonly y: number,
    readonly z: number,
    readonly w: number,
}

/** A readonly opaque color, channels in `[0, 1]`. */
export interface RGB {
    readonly r: number,
    readonly g: number,
    readonly b: number,
}

/** A readonly color with alpha, channels in `[0, 1]`. */
export interface RGBA {
    readonly r: number,
    readonly g: number,
    readonly b: number,
    readonly a: number,
}

/** Absolute value. */
export const abs = (n: number): number => (n < 0 ? -n : n);

/** Smaller of two numbers. */
export const min = (a: number, b: number): number => (a < b ? a : b);

/** Larger of two numbers. */
export const max = (a: number, b: number): number => (a > b ? a : b);

/**
 * Rounds down to the nearest integer, correctly for negative numbers too
 * (unlike a plain `n | 0` truncation, which rounds toward zero).
 */
export const floor = (n: number): number => {
    const t = n | 0;                       // truncates toward zero
    return (n < 0 && t !== n) ? t - 1 : t; // correct for negatives too
};

/** Rounds up to the nearest integer, correctly for negative numbers too. */
export const ceil = (n: number): number => {
    const t = n | 0;
    return (n > 0 && t !== n) ? t + 1 : t;
};

/** Rounds to the nearest integer (half-up). */
export const round = (n: number): number => floor(n + 0.5);

/** Square root. */
export const sqrt = (n: number): number => (n ** 0.5);

/** `base` raised to the power `exp`. */
export const pow = (base: number, exp: number): number => (base ** exp);

/** Euclidean length of the 2D vector `(x, y)`. */
export const hypot2 = (x: number, y: number): number => ((x * x + y * y) ** 0.5);

/** Euclidean length of the 3D vector `(x, y, z)`. */
export const hypot3 = (x: number, y: number, z: number): number => ((x * x + y * y + z * z) ** 0.5);

/**
 * 32-bit integer multiplication (wraps on overflow like `Math.imul`), used
 * internally by {@link Rng} for its splitmix32-derived generator.
 */
export const imul = (a: number, b: number): number => {
    b |= 0;
    let result = (a & 0x003fffff) * b;

    if (a & 0xffc00000) result += ((a & 0xffc00000) * b) | 0;

    return result | 0;
};

const _wrapAngle = (n: number): number => {
    n = n % DOUBLE_PI;

    if (n > PI) n -= DOUBLE_PI;
    else if (n < -PI) n += DOUBLE_PI;

    return n;
};

// Taylor series about 0, accurate to <1e-9 over [0, PI/2] (the series converges
// much slower near +-PI, so callers must reduce to that range first).
const _sinSeries = (n: number): number => {
    const n2 = n * n;

    return n * (1 + n2 * (
        -1 / 6 + n2 * (
            1 / 120 + n2 * (
                -1 / 5040 + n2 * (
                    1 / 362880 + n2 * (-1 / 39916800)
                )
            )
        )
    ));
};

const _cosSeries = (n: number): number => {
    const n2 = n * n;

    return 1 + n2 * (
        -1 / 2 + n2 * (
            1 / 24 + n2 * (
                -1 / 720 + n2 * (
                    1 / 40320 + n2 * (-1 / 3628800)
                )
            )
        )
    );
};

// Reduces n to [0, PI/2] via wrapping + odd/even + quadrant-fold symmetry, and
// returns the sign flips needed to reconstruct sin/cos of the original angle.
const _reduceAngle = (n: number): [x: number, sinSign: number, cosSign: number] => {
    let x = _wrapAngle(n);

    let sinSign = 1;

    if (x < 0) {
        x = -x;
        sinSign = -1;
    }

    let cosSign = 1;

    if (x > HALF_PI) {
        x = PI - x;
        cosSign = -1;
    }

    return [x, sinSign, cosSign];
};

/**
 * Sine of `n` radians, computed from a Taylor series (accurate to <1e-9)
 * after reducing the angle into `[0, PI/2]` - a dependency-free alternative
 * to `Math.sin`.
 */
export const sin = (n: number): number => {
    const [x, sinSign] = _reduceAngle(n);
    return sinSign * _sinSeries(x);
};

/** Cosine of `n` radians. See {@link sin} for the approximation approach. */
export const cos = (n: number): number => {
    const [x, , cosSign] = _reduceAngle(n);
    return cosSign * _cosSeries(x);
};

/** Restricts `value` to the inclusive range `[lo, hi]`. */
export const clamp = (value: number, lo: number, hi: number): number => max(lo, min(hi, value));

/** Converts an angle in degrees to radians. */
export const deg2rad = (degree: number): number => (degree * RADIAN_FACTOR);

/** Linear interpolation between `start` and `end` at position `scale` (`0` = start, `1` = end). */
export const lerp = (start: number, end: number, scale: number): number => (start * (1 - scale) + end * scale);

/** Euclidean distance between 2D points `(x1, y1)` and `(x2, y2)`. */
export const distance2d = (x1: number, y1: number, x2: number, y2: number): number => hypot2(x2 - x1, y2 - y1);

/** Euclidean distance between 3D points `(x1, y1, z1)` and `(x2, y2, z2)`. */
export const distance3d = (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): number => hypot3(x2 - x1, y2 - y1, z2 - z1);

/** Squared Euclidean distance between 2D points - cheaper than {@link distance2d} when only comparing distances. */
export const squaredDistance = (x1: number, y1: number, x2: number, y2: number): number => {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return dx * dx + dy * dy;
};

/** Sum of absolute axis differences between 2D points (grid/taxicab distance). */
export const manhattanDistance = (x1: number, y1: number, x2: number, y2: number): number => abs(x1 - x2) + abs(y1 - y2);

/**
 * Rounds `value` to a given number of `digits` in an arbitrary `base`
 * (named `roundTo` rather than `round`, which already exists above with a
 * different signature).
 */
export const roundTo = (value: number, digits: number, base: number = 10): number => {
    const p = pow(base, digits);
    return round(value * p) / p;
};
