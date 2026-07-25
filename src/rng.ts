import {
    TAU,
    acos,
    cbrt,
    cos,
    floor,
    sin,
    sqrt,
} from "./math";

import { Random } from "./random";

export class RandomTools {
    readonly rng: Random;

    get seed(): number { return this.rng.seed; }
    set seed(seed: number) { this.rng.seed = seed; }

    constructor(seed?: number | Random) {
        this.rng =
            seed instanceof Random
                ? seed
                : new Random(seed);
    }

    //----------------------------------------------------------------------
    // Numbers
    //----------------------------------------------------------------------

    nextFloat(): number {
        return this.rng.float();
    }

    nextUint(): number {
        return this.rng.uint();
    }

    floatRange(min: number, max?: number): number {
        if (typeof max !== 'number') {
            max = min;
            min = 0;
        }

        return min + this.rng.float() * (max - min);
    }

    range(min: number, max?: number): number {
        if (typeof max !== 'number') {
            max = min;
            min = 0;
        }

        return floor(this.floatRange(min, max));
    }

    //----------------------------------------------------------------------
    // Collections
    //----------------------------------------------------------------------

    pick<T>(array: readonly T[]): T {
        return array[this.range(0, array.length - 1)];
    }

    sample<T>(
        array: readonly T[],
        count: number,
    ): T[] {
        return this.shuffle(array).slice(0, count);
    }

    shuffle<T>(array: readonly T[]): T[] {
        const result = [...array];

        for (let i = result.length - 1; i > 0; --i) {
            const j = this.range(0, i);

            [result[i], result[j]] =
                [result[j], result[i]];
        }

        return result;
    }

    chance(probability: number): boolean {
        return this.rng.float() < probability;
    }

    //----------------------------------------------------------------------
    // Geometry
    //----------------------------------------------------------------------

    vector2(): [number, number] {
        const θ = this.rng.angle();

        return [
            cos(θ),
            sin(θ),
        ];
    }

    pointOnCircle(radius = 1): [number, number] {
        const θ = this.rng.angle();

        return [
            radius * cos(θ),
            radius * sin(θ),
        ];
    }

    pointInCircle(radius = 1): [number, number] {
        const θ = this.rng.angle();
        const r = sqrt(this.rng.float()) * radius;

        return [
            r * cos(θ),
            r * sin(θ),
        ];
    }

    pointOnSphere(radius = 1): [number, number, number] {
        const u = this.rng.float();
        const v = this.rng.float();

        const θ = TAU * u;
        const φ = acos(2 * v - 1);

        const s = sin(φ);

        return [
            radius * s * cos(θ),
            radius * s * sin(θ),
            radius * cos(φ),
        ];
    }

    pointInSphere(radius = 1): [number, number, number] {
        const u = this.rng.float();
        const v = this.rng.float();

        const θ = TAU * u;
        const φ = acos(2 * v - 1);

        const r = radius * cbrt(this.rng.float());
        const s = sin(φ);

        return [
            r * s * cos(θ),
            r * s * sin(θ),
            r * cos(φ),
        ];
    }

    //----------------------------------------------------------------------
    // Distributions
    //----------------------------------------------------------------------

    gaussian(
        mean = 0,
        standardDeviation = 1,
    ): number {

        let u = 0;
        let v = 0;

        while (u === 0) u = this.rng.float();
        while (v === 0) v = this.rng.float();

        const z =
            sqrt(-2 * Math.log(u)) *
            cos(TAU * v);

        return mean + z * standardDeviation;
    }

    //----------------------------------------------------------------------
    // Matrices
    //----------------------------------------------------------------------

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
                        this.floatRange(min, max),
                ),
        );
    }

    transformMatrix(
        rows: number,
        columns = rows,
    ): number[][] {

        return this.matrix(rows, columns, -1, 1);
    }
}

export const rng = new RandomTools();
