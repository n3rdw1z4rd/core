import { floor } from "./math";

/**
 * Sparse 2D grid keyed by coordinate, generic over cell type `T` (unlike
 * {@link Map2D}, which is numbers-only). Useful when tiles need to carry
 * more than a single numeric value.
 */
export class Tilemap<T = number> {
    map: Map<string, T> = new Map();

    private _key(x: number, y: number): string {
        x = floor(x);
        y = floor(y);

        return `${x}x${y}`;
    }

    /** Reads the tile at `(x, y)` (floored), or `undefined` if unset. */
    get(x: number, y: number): T | undefined {
        return this.map.get(this._key(x, y));
    }

    /** Sets the tile at `(x, y)` (floored). */
    set(x: number, y: number, v: T) {
        this.map.set(this._key(x, y), v);
    }
}
