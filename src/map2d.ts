/**
 * Default "empty" value of a {@link Map2D}: cells holding it are not stored.
 *
 * @category Maps & Spatial
 */
export const DEFAULT_MAP_2D_VALUE = -1;

// 2^21 per axis: safe range is roughly ±1,048,575, comfortably covers voxel/tile coordinates
const BASE_2D = 0x200000;
const OFFSET_2D = 0x100000;

/**
 * Lowest supported coordinate on each axis of a {@link Map2D} (inclusive, -1,048,576); anything
 * outside the range wraps around and collides with other coordinates.
 *
 * @category Maps & Spatial
 */
export const MAP_2D_MIN_COORD = -OFFSET_2D;
/**
 * Highest supported coordinate on each axis of a {@link Map2D} (inclusive, 1,048,575).
 *
 * @category Maps & Spatial
 */
export const MAP_2D_MAX_COORD = BASE_2D - OFFSET_2D - 1;

/**
 * Backing store of {@link Map2D} and {@link Map3D}: packed integer coordinate key -> cell value.
 *
 * @category Maps & Spatial
 */
export type Map2DData = Map<number, number>;

/**
 * Sparse 2D grid of numbers keyed by integer coordinates. Coordinates are floored, so any point
 * inside a cell addresses that cell. Cells holding `defaultValue` are not stored: setting a cell to
 * it removes the cell, and reading a missing cell returns it.
 *
 * Supports coordinates in [{@link MAP_2D_MIN_COORD}, {@link MAP_2D_MAX_COORD}] per axis; outside
 * that range keys wrap around (a one-time `console.warn` per map reports it).
 *
 * ```ts
 * const map = new Map2D();     // empty = -1
 * map.set(3, -2, 7);
 * map.get(3.9, -1.5);          // 7 (floored to 3, -2)
 * map.get(0, 0);               // -1
 * map.set(3, -2);              // back to empty: removed
 * ```
 *
 * @category Maps & Spatial
 */
export class Map2D {
    /** value of every cell that hasn't been set; default {@link DEFAULT_MAP_2D_VALUE} */
    readonly defaultValue: number;

    private _data: Map2DData;
    private _warnedOutOfRange = false;

    /** the backing map (packed keys), shared, not a copy */
    get data(): Map2DData { return this._data; }
    /** number of stored (non-default) cells */
    get size(): number { return this._data.size; }

    /**
     * @param mapData existing backing data to use as is (not copied), e.g. another map's `data`
     */
    constructor(
        defaultValue: number = DEFAULT_MAP_2D_VALUE,
        mapData?: Map2DData,
    ) {
        this.defaultValue = defaultValue;
        this._data = mapData ?? new Map();
    }

    private _floor(x: number, y: number): [number, number] {
        return [Math.floor(x), Math.floor(y)];
    }

    private _key(x: number, y: number): number {
        if (
            !this._warnedOutOfRange && (
                x < MAP_2D_MIN_COORD || x > MAP_2D_MAX_COORD ||
                y < MAP_2D_MIN_COORD || y > MAP_2D_MAX_COORD
            )
        ) {
            this._warnedOutOfRange = true; // once per map, so hot loops don't flood the console

            console.warn(
                `Map2D: (${x}, ${y}) is outside the supported range ` +
                `[${MAP_2D_MIN_COORD}, ${MAP_2D_MAX_COORD}] per axis; it wraps around and collides ` +
                `with other coordinates. Further warnings for this map are suppressed.`,
            );
        }

        const X = (x + OFFSET_2D) & (BASE_2D - 1);
        const Y = (y + OFFSET_2D) & (BASE_2D - 1);
        return (X * BASE_2D) + Y;
    }

    private _pos(key: number): [number, number] {
        const Y = key % BASE_2D;
        const X = Math.floor(key / BASE_2D);
        return [X - OFFSET_2D, Y - OFFSET_2D];
    }

    /** Removes every stored cell. */
    clear() {
        this._data.clear();
    }

    /**
     * Value of the cell containing (x, y) (coordinates are floored).
     *
     * @param defaultValue returned when the cell isn't stored; defaults to the map's `defaultValue`
     */
    get(x: number, y: number, defaultValue: number = this.defaultValue): number {
        [x, y] = this._floor(x, y);

        return this._data.get(this._key(x, y)) ?? defaultValue;
    }

    /** Sets the cell containing (x, y); leave out `value` (or pass `defaultValue`) to remove it. */
    set(x: number, y: number, value: number = this.defaultValue) {
        [x, y] = this._floor(x, y);

        const key = this._key(x, y);

        if (value === this.defaultValue) {
            this._data.delete(key);
        } else {
            this._data.set(key, value);
        }
    }

    /**
     * Calls `callback` for every stored cell, in insertion order, with its coordinates, value `n`
     * and running index `i`. Cells holding the default value are not visited.
     */
    forEach(callback: (x: number, y: number, n: number, i: number) => void) {
        let i = 0;

        this._data.forEach((v: number, key: number) => {
            const [x, y] = this._pos(key);
            callback(x, y, v, i++);
        });
    }

    /**
     * Like {@link Map2D.forEach}, limited to stored cells with `x1 <= x <= x2` and `y1 <= y <= y2`
     * (both corners inclusive, as in {@link Map3D.setArea}). Scans every stored cell, so it costs
     * O(size), not O(area).
     */
    forEachInArea(
        x1: number, y1: number,
        x2: number, y2: number,
        callback: (x: number, y: number, n: number) => void,
    ) {
        this.forEach((x: number, y: number, n: number) => {
            if (x >= x1 && x <= x2 && y >= y1 && y <= y2) {
                callback(x, y, n);
            }
        });
    }
}
