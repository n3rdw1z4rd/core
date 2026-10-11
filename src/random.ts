import { hash32mix, TAU } from "./math";

export class Random {
    private _seed: number;
    private _counter: number = 0;

    constructor(seed: number = Date.now()) {
        this._seed = seed | 0;
    }

    get seed(): number {
        return this._seed;
    }

    // re-seeding also restarts the sequence
    set seed(value: number) {
        this._seed = value | 0;
        this._counter = 0;
    }

    // hashing (seed, counter) rather than (seed + counter) keeps nearby seeds from producing
    // the same sequence shifted by a few draws
    private _next(): number {
        const n = this._counter;
        this._counter = (this._counter + 1) | 0;
        return n;
    }

    static hash(...values: number[]): number {
        return hash32mix(...values);
    }

    static uint(...values: number[]): number {
        return hash32mix(...values);
    }

    static float(...values: number[]): number {
        return hash32mix(...values) / 0x100000000;
    }

    static bool(...values: number[]): boolean {
        return (hash32mix(...values) & 1) !== 0;
    }

    static sign(...values: number[]): -1 | 1 {
        return this.bool(...values) ? 1 : -1;
    }

    static angle(...values: number[]): number {
        return this.float(...values) * TAU;
    }

    uint(): number {
        return Random.uint(this._seed, this._next());
    }

    float(): number {
        return Random.float(this._seed, this._next());
    }

    bool(): boolean {
        return Random.bool(this._seed, this._next());
    }

    sign(): -1 | 1 {
        return Random.sign(this._seed, this._next());
    }

    angle(): number {
        return Random.angle(this._seed, this._next());
    }
}
