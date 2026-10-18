import { Random } from "./random";
import { TAU } from "./math";

/**
 * Seeded random number generator with helpers for ranges, picking, shuffling, geometric points,
 * Gaussian samples and matrices. Every call advances the underlying {@link Random}, so a given
 * seed always reproduces the same sequence of calls.
 *
 * ```ts
 * const r = new Rng(1234);
 * r.range(1, 7);               // integer in [1, 7), like a die roll
 * r.pick(['a', 'b', 'c']);
 * r.shuffle([1, 2, 3, 4]);     // new array, input untouched
 * ```
 *
 * A shared, time-seeded instance is exported as {@link rng}.
 * @category Math & Random
 */
export class Rng {
    /** the underlying generator; shared if one was passed to the constructor */
    readonly random: Random;

    /** the underlying {@link Random}'s current seed; setting it restarts the sequence */
    get seed(): number { return this.random.seed; }
    /** sets the underlying {@link Random}'s seed */
    set seed(seed: number) { this.random.seed = seed; }

    /** @param seed a seed (default `Date.now()`), or an existing {@link Random} to wrap */
    constructor(seed?: number | Random) {
        this.random =
            seed instanceof Random
                ? seed
                : new Random(seed);
    }

    /** Float in [0, 1). */
    nextFloat(): number {
        return this.random.float();
    }

    /** Unsigned 32-bit integer in [0, 2³²). */
    nextUint(): number {
        return this.random.uint();
    }

    /**
     * random integer in [min, max); range(max) is [0, max). Non-integer bounds are rounded up,
     * so the result is always an integer inside the requested range.
     */
    range(min: number, max?: number): number {
        if (typeof max !== 'number') {
            max = min;
            min = 0;
        }

        min = Math.ceil(min);
        max = Math.ceil(max);

        return min + Math.floor(this.random.float() * (max - min));
    }

    /** A uniformly chosen element of `array`; `undefined` if the array is empty. */
    pick<T>(array: readonly T[]): T {
        return array[this.range(0, array.length)];
    }

    /** Up to `count` distinct elements of `array` in random order (all of them if `count` exceeds its length). */
    sample<T>(
        array: readonly T[],
        count: number,
    ): T[] {
        return this.shuffle(array).slice(0, count);
    }

    /** A shuffled copy of `array` (Fisher-Yates); the input is not modified. */
    shuffle<T>(array: readonly T[]): T[] {
        const result = [...array];

        for (let i = result.length - 1; i > 0; --i) {
            const j = this.range(0, i + 1);

            [result[i], result[j]] =
                [result[j], result[i]];
        }

        return result;
    }

    /** True with the given probability (0 = never, 1 = always). */
    chance(probability: number): boolean {
        return this.random.float() < probability;
    }

    /** Random unit-length 2D direction as `[x, y]`. */
    vector2(): [number, number] {
        const θ = this.random.angle();

        return [
            Math.cos(θ),
            Math.sin(θ),
        ];
    }

    /** Uniform point on a circle of `radius` (default 1) centred on the origin, as `[x, y]`. */
    pointOnCircle(radius = 1): [number, number] {
        const θ = this.random.angle();

        return [
            radius * Math.cos(θ),
            radius * Math.sin(θ),
        ];
    }

    /** Uniform point inside a disc of `radius` (default 1) centred on the origin, as `[x, y]`. */
    pointInCircle(radius = 1): [number, number] {
        const θ = this.random.angle();
        const r = Math.sqrt(this.random.float()) * radius;

        return [
            r * Math.cos(θ),
            r * Math.sin(θ),
        ];
    }

    /** Uniform point on the surface of a sphere of `radius` (default 1) centred on the origin, as `[x, y, z]`. */
    pointOnSphere(radius = 1): [number, number, number] {
        const u = this.random.float();
        const v = this.random.float();

        const θ = TAU * u;
        const φ = Math.acos(2 * v - 1);

        const s = Math.sin(φ);

        return [
            radius * s * Math.cos(θ),
            radius * s * Math.sin(θ),
            radius * Math.cos(φ),
        ];
    }

    /** Uniform point inside a ball of `radius` (default 1) centred on the origin, as `[x, y, z]`. */
    pointInSphere(radius = 1): [number, number, number] {
        const u = this.random.float();
        const v = this.random.float();

        const θ = TAU * u;
        const φ = Math.acos(2 * v - 1);

        const r = radius * Math.cbrt(this.random.float());
        const s = Math.sin(φ);

        return [
            r * s * Math.cos(θ),
            r * s * Math.sin(θ),
            r * Math.cos(φ),
        ];
    }

    /** Normally distributed sample (Box-Muller), default mean 0 and standard deviation 1. */
    gaussian(
        mean = 0,
        standardDeviation = 1,
    ): number {

        let u = 0;
        let v = 0;

        while (u === 0) u = this.random.float();
        while (v === 0) v = this.random.float();

        const z =
            Math.sqrt(-2 * Math.log(u)) *
            Math.cos(TAU * v);

        return mean + z * standardDeviation;
    }

    /**
     * `rows` x `columns` array of uniform floats in [`min`, `max`) (default [0, 1)); `columns`
     * defaults to `rows`.
     */
    matrix(
        rows: number,
        columns = rows,
        min = 0,
        max = 1,
    ): number[][] {

        return Array.from(
            { length: rows },
            () =>
                Array.from(
                    { length: columns },
                    () =>
                        min + this.random.float() * (max - min),
                ),
        );
    }

    /** Same as {@link Rng.matrix} with values in [-1, 1). */
    transformMatrix(
        rows: number,
        columns = rows,
    ): number[][] {

        return this.matrix(rows, columns, -1, 1);
    }

    /** Random color as `[r, g, b]`, each an integer in [0, 255]. */
    rgb(): [number, number, number] {
        return [this.range(256), this.range(256), this.range(256)];
    }
}

/**
 * Shared {@link Rng} seeded from `Date.now()` at module load; set `rng.seed` for reproducible results.
 * @category Math & Random
 */
export const rng = new Rng();
