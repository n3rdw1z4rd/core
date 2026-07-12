export const PI = 3.14159265358979323846;
export const DOUBLE_PI = PI * 2;
export const HALF_PI = PI / 2;
export const RADIAN_FACTOR = PI / 180.0;

export interface XY {
    x: number,
    y: number,
}

export interface XYZ {
    x: number,
    y: number,
    z: number,
}

export interface XYZW {
    x: number,
    y: number,
    z: number,
    w: number,
}

export interface RGB {
    r: number,
    g: number,
    b: number,
}

export interface RGBA {
    r: number,
    g: number,
    b: number,
    a: number,
}

export const abs = (n: number): number => (n < 0 ? -n : n);

export const min = (a: number, b: number): number => (a < b ? a : b);

export const max = (a: number, b: number): number => (a > b ? a : b);

export const floor = (n: number): number => {
    const t = n | 0;                       // truncates toward zero
    return (n < 0 && t !== n) ? t - 1 : t; // correct for negatives too
};

export const ceil = (n: number): number => {
    const t = n | 0;
    return (n > 0 && t !== n) ? t + 1 : t;
};

export const round = (n: number): number => floor(n + 0.5);

export const sqrt = (n: number): number => (n ** 0.5);

export const pow = (base: number, exp: number): number => (base ** exp);

export const hypot2 = (x: number, y: number): number => ((x * x + y * y) ** 0.5);

export const hypot3 = (x: number, y: number, z: number): number => ((x * x + y * y + z * z) ** 0.5);

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

export const sin = (n: number): number => {
    const [x, sinSign] = _reduceAngle(n);
    return sinSign * _sinSeries(x);
};

export const cos = (n: number): number => {
    const [x, , cosSign] = _reduceAngle(n);
    return cosSign * _cosSeries(x);
};

export const clamp = (value: number, lo: number, hi: number): number => max(lo, min(hi, value));

export const deg2rad = (degree: number): number => (degree * RADIAN_FACTOR);

export const lerp = (start: number, end: number, scale: number): number => (start * (1 - scale) + end * scale);

export const distance2d = (x1: number, y1: number, x2: number, y2: number): number => hypot2(x2 - x1, y2 - y1);

export const distance3d = (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): number => hypot3(x2 - x1, y2 - y1, z2 - z1);

export const squaredDistance = (x1: number, y1: number, x2: number, y2: number): number => {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return dx * dx + dy * dy;
};

export const manhattanDistance = (x1: number, y1: number, x2: number, y2: number): number => abs(x1 - x2) + abs(y1 - y2);

export const roundTo = (value: number, digits: number, base: number = 10): number => {
    const p = pow(base, digits);
    return round(value * p) / p;
};
