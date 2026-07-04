import { floor } from './math';

const DEFAULT_VALUE = -1;

export class Map2D {
    readonly defaultValue: number;

    private _data: Map<string, number>;

    get size(): number { return this._data.size; }

    constructor(defaultValue: number = DEFAULT_VALUE) {
        this.defaultValue = defaultValue;
        this._data = new Map();
    }

    private _floor(x: number, y: number): [number, number] {
        return [floor(x), floor(y)];
    }

    private _key(x: number, y: number): string {
        return `${x},${y}`;
    }

    private _pos(key: string): [number, number] {
        return key.split(',').map((v: string) => parseInt(v)) as [number, number];
    }

    clear() {
        this._data.clear();
    }

    get(x: number, y: number, defaultValue: number = this.defaultValue): number {
        [x, y] = this._floor(x, y);

        return this._data.get(this._key(x, y)) ?? defaultValue;
    }

    set(x: number, y: number, value: number = this.defaultValue) {
        [x, y] = this._floor(x, y);

        const key = this._key(x, y);

        if (value === this.defaultValue) {
            this._data.delete(key);
        } else {
            this._data.set(key, value);
        }
    }

    forEach(callback: (x: number, y: number, v: number) => void) {
        this._data.forEach((v: number, key: string) => {
            const [x, y] = this._pos(key);
            callback(x, y, v);
        });
    }
}
