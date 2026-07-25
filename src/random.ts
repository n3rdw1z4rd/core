import { TAU, imul } from "./math";

const hash32 = (seed: number): number => {
    seed |= 0;

    seed ^= seed >>> 16;
    seed = imul(seed, 0x85ebca6b);

    seed ^= seed >>> 13;
    seed = imul(seed, 0xc2b2ae35);

    seed ^= seed >>> 16;

    return seed >>> 0;
};

export class Random {
    private _seed: number;

    constructor(seed: number = Date.now()) {
        this._seed = seed | 0;
    }

    get seed(): number {
        return this._seed;
    }

    set seed(value: number) {
        this._seed = value | 0;
    }

    //--------------------------------------------------------------------------
    // Internal
    //--------------------------------------------------------------------------

    private static _mix(...values: number[]): number {
        let seed = 0;

        for (const value of values) {
            seed ^= value | 0;
            seed = hash32(seed);
        }

        return seed;
    }

    //--------------------------------------------------------------------------
    // Stateless
    //--------------------------------------------------------------------------

    static hash(...values: number[]): number {
        return this._mix(...values);
    }

    static uint(...values: number[]): number {
        return this._mix(...values);
    }

    static float(...values: number[]): number {
        return this._mix(...values) / 0x100000000;
    }

    static bool(...values: number[]): boolean {
        return (this._mix(...values) & 1) !== 0;
    }

    static sign(...values: number[]): -1 | 1 {
        return this.bool(...values) ? 1 : -1;
    }

    static angle(...values: number[]): number {
        return this.float(...values) * TAU;
    }

    //--------------------------------------------------------------------------
    // Stateful
    //--------------------------------------------------------------------------

    uint(): number {
        return Random.uint(this._seed++);
    }

    float(): number {
        return Random.float(this._seed++);
    }

    bool(): boolean {
        return Random.bool(this._seed++);
    }

    sign(): -1 | 1 {
        return Random.sign(this._seed++);
    }

    angle(): number {
        return Random.angle(this._seed++);
    }
}
