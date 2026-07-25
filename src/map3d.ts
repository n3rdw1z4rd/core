import { floor } from "./math";

const DEFAULT_VALUE = -1;

// 2^22 per axis: safe range is roughly ±2,097,151, three axes still fit within Number.MAX_SAFE_INTEGER (2^53)
const BASE_3D = 0x20000;
const OFFSET_3D = 0x10000;

export type Map3DData = Map<number, number>;

export class Map3D {
    readonly defaultValue: number;

    private _data: Map3DData;

    get data(): Map3DData { return this._data; }
    get size(): number { return this._data.size; }

    constructor(defaultValue: number = DEFAULT_VALUE) {
        this.defaultValue = defaultValue;
        this._data = new Map();
    }

    private _floor(x: number, y: number, z: number): [number, number, number] {
        return [floor(x), floor(y), floor(z)];
    }

    private _key(x: number, y: number, z: number): number {
        const X = (x + OFFSET_3D) & (BASE_3D - 1);
        const Y = (y + OFFSET_3D) & (BASE_3D - 1);
        const Z = (z + OFFSET_3D) & (BASE_3D - 1);
        return (X * BASE_3D * BASE_3D) + (Y * BASE_3D) + Z;
    }

    private _pos(key: number): [number, number, number] {
        const Z = key % BASE_3D;
        const Y = Math.floor(key / BASE_3D) % BASE_3D;
        const X = Math.floor(key / (BASE_3D * BASE_3D));

        return [X - OFFSET_3D, Y - OFFSET_3D, Z - OFFSET_3D];
    }

    public clear() {
        this._data.clear();
    }

    public get(x: number, y: number, z: number, defaultValue: number = this.defaultValue): number {
        [x, y, z] = this._floor(x, y, z);

        return this._data.get(this._key(x, y, z)) ?? defaultValue;
    }

    public set(x: number, y: number, z: number, value: number = this.defaultValue) {
        [x, y, z] = this._floor(x, y, z);

        const key = this._key(x, y, z);

        if (value === this.defaultValue) {
            this._data.delete(key);
        } else {
            this._data.set(key, value);
        }
    }

    public forEach(callback: (x: number, y: number, z: number, v: number) => void) {
        this._data.forEach((v: number, key: number) => {
            const [x, y, z] = this._pos(key);
            callback(x, y, z, v);
        });
    }
}