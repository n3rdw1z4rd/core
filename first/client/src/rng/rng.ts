import { Generator, Generators } from './generators';

class Rng {
    private _seed: number = +new Date() + Math.random();
    private _defaultGenerator: Generator = Generators.Mulberry32;
    private _rng: Function = this._set_rng();

    public get seed(): number { return this._seed; }
    public set seed(value: number) {
        this._seed = value;
        this._rng = this._set_rng();
    }

    public get nextf(): number {
        return this._rng();
    }

    public get nexti(): number {
        
    }

    public setGenerator(generator: Generator, seed: number = this._seed) {
        this._defaultGenerator = generator;
        this.seed = seed;
    }

    public static getInstance(): Rng {
        if (!Rng._instance) {
            Rng._instance = new Rng();
        }

        return Rng._instance;
    }

    private _set_rng(): Function {
        return (seed: number): Function => this._defaultGenerator(seed);
    }

    private static _instance: Rng;

    private constructor() { }
}