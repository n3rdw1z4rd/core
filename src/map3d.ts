import { floor } from "./math";

const DEFAULT_VALUE = -1;

/** Backing store type for {@link Map3D} - a string-keyed sparse map. */
export type Map3DData = Map<string, number>;

/** 3D counterpart to {@link Map2D} - a sparse voxel grid of numbers. */
export class Map3D {
    readonly defaultValue: number;

    private _data: Map3DData;

    /** Direct access to the underlying sparse store. */
    get data(): Map3DData { return this._data; }

    constructor(defaultValue: number = DEFAULT_VALUE) {
        this.defaultValue = defaultValue;
        this._data = new Map();
    }

    private _floor(x: number, y: number, z: number): [number, number, number] {
        return [floor(x), floor(y), floor(z)];
    }

    private _key(x: number, y: number, z: number): string {
        return `${x},${y},${z}`;
    }

    private _pos(key: string): [number, number, number] {
        return key.split(',').map((v: string) => parseInt(v)) as [number, number, number];
    }

    /** Removes every stored cell. */
    clear() {
        this._data.clear();
    }

    /** Reads the value at `(x, y, z)` (coordinates are floored), or `defaultValue` if unset. */
    get(x: number, y: number, z: number, defaultValue: number = this.defaultValue): number {
        [x, y, z] = this._floor(x, y, z);

        return this._data.get(this._key(x, y, z)) ?? defaultValue;
    }

    /** Sets the value at `(x, y, z)`. Setting it back to {@link defaultValue} removes the entry entirely. */
    set(x: number, y: number, z: number, value: number = this.defaultValue) {
        [x, y, z] = this._floor(x, y, z);

        const key = this._key(x, y, z);

        if (value === this.defaultValue) {
            this._data.delete(key);
        } else {
            this._data.set(key, value);
        }
    }

    /** Iterates every stored (non-default) cell. */
    forEach(callback: (x: number, y: number, z: number, v: number) => void) {
        this._data.forEach((v: number, key: string) => {
            const [x, y, z] = this._pos(key);
            callback(x, y, z, v);
        });
    }
}
