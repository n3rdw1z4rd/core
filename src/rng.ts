import { imul, PI, sin, cos, sqrt, type VEC2 } from './math';

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

    public get seed(): number {
        return this._seed;
    }

    public set seed(value: number) {
        this._seed = value;
        this.__seed = this._seed;
    }

    public get startingSeed(): number {
        return this.__seed;
    }

    public get nextf(): number {
        // adapted from: https://github.com/bryc/code/blob/master/jshash/PRNGs.md#splitmix32
        this._seed |= 0;
        this._seed = (this._seed + 0x9e3779b9) | 0;

        let t: number = this._seed ^ (this._seed >>> 16);
        t = imul(t, 0x21f0aaad);
        t = t ^ (t >>> 15);
        t = imul(t, 0x735a2d97);

        return ((t = t ^ (t >>> 15)) >>> 0) / 4294967296;
    }

    public get nexti(): number {
        return (this.nextf * Number.MAX_SAFE_INTEGER) | 0;
    }

    // NOTE: as of the core/apparatus consolidation, range(min, max) treats
    // max as EXCLUSIVE (previous published versions of this package treated
    // it as inclusive - if you're upgrading from an older @n3rdw1z4rd/core,
    // range(0, 10) now returns [0, 10) instead of [0, 10]).
    public range(min: number, max?: number): number {
        if (max === undefined) {
            max = min;
            min = 0;
        }

        return (min + this.nextf * (max - min)) | 0;
    }

    public randomUnitVector(): VEC2 {
        const theta = this.nextf * 2 * PI;
        return [cos(theta), sin(theta)];
    }

    // Box-Muller-ish gaussian sample, mean 0.5 stddev 1/6 (so ~99.7% of
    // samples land in [0, 1]). Uses native Math.log since a pure natural-log
    // implementation isn't part of math.ts yet.
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

    public shuffle(value: Array<any> | string): Array<any> | string {
        if (Array.isArray(value)) {
            return value.sort(() => (0.5 - this.nextf));
        } else {
            return value.split('').sort(() => (0.5 - this.nextf)).join('');
        }
    }

    public uid(length: number = 16): string {
        const uid: string[] = [];
        for (let i = 0; i < length; i++) uid.push(this.choose(this._uid_characters));
        return uid.join('');
    }

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

export const rng: Rng = new Rng();
