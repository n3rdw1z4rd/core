export class Tilemap<T = number> {
    map: Map<string, T> = new Map();

    private _key(x: number, y: number): string {
        x = Math.floor(x);
        y = Math.floor(y);

        return `${x}x${y}`;
    }

    get(x: number, y: number): T | undefined {
        return this.map.get(this._key(x, y));
    }

    set(x: number, y: number, v: T) {
        this.map.set(this._key(x, y), v);
    }
}
