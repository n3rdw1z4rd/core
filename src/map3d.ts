import { floor } from './math';

const DEFAULT_VALUE = -1;

export type Map3DData = Map<string, number>;

export class Map3D {
    readonly defaultValue: number;

    private _data: Map3DData;

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

    clear() {
        this._data.clear();
    }

    get(x: number, y: number, z: number, defaultValue: number = this.defaultValue): number {
        [x, y, z] = this._floor(x, y, z);

        return this._data.get(this._key(x, y, z)) ?? defaultValue;
    }

    set(x: number, y: number, z: number, value: number = this.defaultValue) {
        [x, y, z] = this._floor(x, y, z);

        const key = this._key(x, y, z);

        if (value === this.defaultValue) {
            this._data.delete(key);
        } else {
            this._data.set(key, value);
        }
    }

    forEach(callback: (x: number, y: number, z: number, v: number) => void) {
        this._data.forEach((v: number, key: string) => {
            const [x, y, z] = this._pos(key);
            callback(x, y, z, v);
        });
    }
}
