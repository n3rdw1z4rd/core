import { vec2 } from 'gl-matrix';

export class Rng {
    private _seed: number = Date.now();
    private _uid_characters: string = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

    constructor() {
        this._uid_characters = this.shuffle(this._uid_characters) as string;
        this.seed = this.nexti;
    }

    public get seed(): number {
        return this._seed;
    }

    public set seed(value: number) {
        this._seed = value;
    }

    public get nextf(): number {
        // adapted from: https://github.com/bryc/code/blob/master/jshash/PRNGs.md#splitmix32
        this._seed |= 0;
        this._seed = this._seed + 0x9e3779b9 | 0;

        let t: number = this._seed ^ this._seed >>> 16;
        t = Math.imul(t, 0x21f0aaad);
        t = t ^ t >>> 15;
        t = Math.imul(t, 0x735a2d97);

        return ((t = t ^ t >>> 15) >>> 0) / 4294967296;
    }

    public get nexti(): number {
        return (this.nextf * Number.MAX_SAFE_INTEGER) | 0;
    }

    public range(min: number, max?: number): number {
        if (max === undefined) {
            if (min !== 0) {
                max = min;
                min = 0;
            } else {
                max = Number.MAX_SAFE_INTEGER;
            }
        }

        return ((this.nextf * (max - min + 1)) + min) | 0;
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

    public randomUnitVector(): vec2 {
        const theta = rng.nextf * 2 * Math.PI;
        return vec2.fromValues(Math.cos(theta), Math.sin(theta));
    }
}

export const rng: Rng = new Rng();
