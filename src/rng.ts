import { imul, PI, sin, cos, sqrt } from "./math";

/**
 * Seedable pseudo-random number generator (splitmix32-derived), plus a set
 * of higher-level helpers built on top of it (`range`, `choose`, `shuffle`,
 * `uid`, gaussian sampling, etc). A default shared instance is exported as
 * {@link rng}.
 */
export class Rng {
    private __seed: number;
    private _seed: number;

    private _uid_characters: string =
        '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

    constructor() {
        this._seed = Date.now();
        this.__seed = this._seed;
        this._uid_characters = this.shuffle(this._uid_characters) as string;

        this.seed = this.nexti;
    }

    /** Current internal seed/state. */
    public get seed(): number {
        return this._seed;
    }

    /** Reseeds the generator. Also resets {@link startingSeed} to this value. */
    public set seed(value: number) {
        this._seed = value;
        this.__seed = this._seed;
    }

    /** The seed this instance was first constructed/reseeded with, unaffected by subsequent draws. */
    public get startingSeed(): number {
        return this.__seed;
    }

    /**
     * Next pseudo-random float in `[0, 1)`, advancing the internal state.
     * Adapted from the splitmix32 algorithm:
     * https://github.com/bryc/code/blob/master/jshash/PRNGs.md#splitmix32
     */
    public get nextf(): number {
        this._seed |= 0;
        this._seed = (this._seed + 0x9e3779b9) | 0;

        let t: number = this._seed ^ (this._seed >>> 16);
        t = imul(t, 0x21f0aaad);
        t = t ^ (t >>> 15);
        t = imul(t, 0x735a2d97);

        return ((t = t ^ (t >>> 15)) >>> 0) / 4294967296;
    }

    /** Next pseudo-random integer, full safe-integer range. See {@link nextf}. */
    public get nexti(): number {
        return (this.nextf * Number.MAX_SAFE_INTEGER) | 0;
    }

    /**
     * Random integer. With one argument, returns a value in `[0, min)`;
     * with two, returns a value in `[min, max)`. **`max` is exclusive** -
     * as of the core/apparatus consolidation this changed from the
     * previously-published inclusive behavior, so `range(0, 10)` now
     * returns `[0, 10)` instead of `[0, 10]`.
     */
    public range(min: number, max?: number): number {
        if (max === undefined) {
            max = min;
            min = 0;
        }

        return (min + this.nextf * (max - min)) | 0;
    }

    /** Random unit-length 2D vector, uniformly distributed by angle. */
    public randomUnitVector(): [number, number] {
        const theta = this.nextf * 2 * PI;
        return [cos(theta), sin(theta)];
    }

    /**
     * Box-Muller-ish gaussian sample, mean `0.5` and stddev `1/6` (so
     * ~99.7% of samples land in `[0, 1]`). Uses native `Math.log` since a
     * pure natural-log implementation isn't part of `math.ts` yet.
     */
    public parkMillerNormal(): number {
        const mean = 1 / 2;
        const stddev = 1 / 6;

        let u = 0;
        let v = 0;

        while (u === 0) u = this.nextf;
        while (v === 0) v = this.nextf;

        const n = sqrt(-2.0 * Math.log(u)) * cos(2.0 * PI * v);

        return n * stddev + mean;
    }

    /**
     * Picks a random element. Pass a single array or string to pick one of
     * its items/characters, or pass multiple arguments to pick one of them.
     */
    public choose(...args: any[]): any {
        if (args.length === 1) {
            if (Array.isArray(args[0])) {
                return args[0][this.range(args[0].length - 1)];
            } else if (typeof args[0] === 'string') {
                return args[0].charAt(this.range(args[0].length - 1));
            } else {
                return args[0];
            }
        } else {
            return args[this.range(args.length - 1)];
        }
    }

    /** Returns a randomly-shuffled copy-order of an array or string (in place for arrays, new string otherwise). */
    public shuffle(value: Array<any> | string): Array<any> | string {
        if (Array.isArray(value)) {
            return value.sort(() => (0.5 - this.nextf));
        } else {
            return value.split('').sort(() => (0.5 - this.nextf)).join('');
        }
    }

    /** Random alphanumeric ID string of the given `length` (default 16). Not cryptographically secure. */
    public uid(length: number = 16): string {
        const uid: string[] = [];
        for (let i = 0; i < length; i++) uid.push(this.choose(this._uid_characters));
        return uid.join('');
    }

    /** Builds a `size x size` matrix of random floats in `[-1, 1)`. */
    public randomMatrix(size: number): number[][] {
        const rows: number[][] = [];

        for (let i = 0; i < size; i++) {
            const row: number[] = [];

            for (let j = 0; j < size; j++) {
                row.push(this.nextf * 2 - 1);
            }

            rows.push(row);
        }

        return rows;
    }
}

/** Default shared {@link Rng} instance, seeded from the current time. */
export const rng: Rng = new Rng();
