import { hash32mix, TAU } from "./math";

/**
 * Hash-based random numbers. The static methods are pure functions of their arguments (the same
 * inputs always give the same result), which makes them handy for coordinate-based noise; an
 * instance is a seeded sequence that hashes its seed and then increments it on every call.
 *
 * ```ts
 * Random.float(x, y);          // same value for the same (x, y), in [0, 1)
 *
 * const random = new Random(42);
 * random.float();               // deterministic sequence for seed 42
 * ```
 *
 * See {@link Rng} for ranges, picking, shuffling and other helpers built on top of it.
 * @category Math & Random
 */
export class Random {
    private _seed: number;

    /** @param seed truncated to a 32-bit integer, default `Date.now()` */
    constructor(seed: number = Date.now()) {
        this._seed = seed | 0;
    }

    /** the next value to be hashed; truncated to a 32-bit integer when set */
    get seed(): number {
        return this._seed;
    }

    /** truncated to a 32-bit integer */
    set seed(value: number) {
        this._seed = value | 0;
    }

    /** Unsigned 32-bit integer in [0, 2³²) derived from `values` (a {@link hash32mix} hash). */
    static uint(...values: number[]): number {
        return hash32mix(...values);
    }

    /** Float in [0, 1) derived from `values`. */
    static float(...values: number[]): number {
        return hash32mix(...values) / 0x100000000;
    }

    /** Boolean derived from `values`. */
    static bool(...values: number[]): boolean {
        return (hash32mix(...values) & 1) !== 0;
    }

    /** -1 or 1 derived from `values`. */
    static sign(...values: number[]): -1 | 1 {
        return this.bool(...values) ? 1 : -1;
    }

    /** Angle in radians in [0, 2π) derived from `values`. */
    static angle(...values: number[]): number {
        return this.float(...values) * TAU;
    }

    /** Next unsigned 32-bit integer in [0, 2³²); advances the seed. */
    uint(): number {
        return Random.uint(this._seed++);
    }

    /** Next float in [0, 1); advances the seed. */
    float(): number {
        return Random.float(this._seed++);
    }

    /** Next boolean; advances the seed. */
    bool(): boolean {
        return Random.bool(this._seed++);
    }

    /** Next -1 or 1; advances the seed. */
    sign(): -1 | 1 {
        return Random.sign(this._seed++);
    }

    /** Next angle in radians in [0, 2π); advances the seed. */
    angle(): number {
        return Random.angle(this._seed++);
    }
}
