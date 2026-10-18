/**
 * Sparse 2D grid of arbitrary values, keyed by floored integer coordinates. Simpler than
 * {@link Map2D} (string keys, any value type, no default value or range limit).
 *
 * @category Maps & Spatial
 */
export class Tilemap<T = number> {
    /** backing store, keyed `"<x>x<y>"` (floored) */
    map: Map<string, T> = new Map();

    private _key(x: number, y: number): string {
        x = Math.floor(x);
        y = Math.floor(y);

        return `${x}x${y}`;
    }

    /** Value of the tile containing (x, y), or `undefined` if none was set. */
    get(x: number, y: number): T | undefined {
        return this.map.get(this._key(x, y));
    }

    /** Sets the tile containing (x, y). */
    set(x: number, y: number, v: T) {
        this.map.set(this._key(x, y), v);
    }
}
