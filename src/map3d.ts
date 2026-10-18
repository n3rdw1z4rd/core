import type { Map2D, Map2DData } from "./map2d";

/**
 * Default "empty" value of a {@link Map3D}: cells holding it are not stored.
 *
 * @category Maps & Spatial
 */
export const DEFAULT_MAP_3D_VALUE = -1;

// 2^17 per axis: safe range is roughly ±65,535, three axes (2^51) still fit within Number.MAX_SAFE_INTEGER (2^53)
const BASE_3D = 0x20000;
const OFFSET_3D = 0x10000;

/**
 * Lowest supported coordinate on each axis of a {@link Map3D} (inclusive, -65,536); anything
 * outside the range wraps around and collides with other coordinates.
 *
 * @category Maps & Spatial
 */
export const MAP_3D_MIN_COORD = -OFFSET_3D;
/**
 * Highest supported coordinate on each axis of a {@link Map3D} (inclusive, 65,535).
 *
 * @category Maps & Spatial
 */
export const MAP_3D_MAX_COORD = BASE_3D - OFFSET_3D - 1;

/**
 * Sparse 3D grid of numbers keyed by integer coordinates, e.g. voxel data. Coordinates are floored,
 * so any point inside a cell addresses that cell. Cells holding `defaultValue` are not stored:
 * setting a cell to it removes the cell, and reading a missing cell returns it.
 *
 * Supports coordinates in [{@link MAP_3D_MIN_COORD}, {@link MAP_3D_MAX_COORD}] per axis; outside
 * that range keys wrap around (a one-time `console.warn` per map reports it).
 *
 * ```ts
 * const voxels = new Map3D();            // empty = -1
 * voxels.setArea(0, 0, 0, 3, 0, 3, 1);   // 4x1x4 floor (bounds inclusive)
 * voxels.get(2, 0, 2);                   // 1
 * const saved = voxels.export();         // [{ x, y, z, n }, ...]
 * ```
 *
 * @category Maps & Spatial
 */
export class Map3D {
    /** value of every cell that hasn't been set; default {@link DEFAULT_MAP_3D_VALUE} */
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
        defaultValue: number = DEFAULT_MAP_3D_VALUE,
        mapData?: Map2DData,
    ) {
        this.defaultValue = defaultValue;
        this._data = mapData ?? new Map();
    }

    private _floor(x: number, y: number, z: number): [number, number, number] {
        return [Math.floor(x), Math.floor(y), Math.floor(z)];
    }

    private _key(x: number, y: number, z: number): number {
        if (
            !this._warnedOutOfRange && (
                x < MAP_3D_MIN_COORD || x > MAP_3D_MAX_COORD ||
                y < MAP_3D_MIN_COORD || y > MAP_3D_MAX_COORD ||
                z < MAP_3D_MIN_COORD || z > MAP_3D_MAX_COORD
            )
        ) {
            this._warnedOutOfRange = true; // once per map, so hot loops don't flood the console

            console.warn(
                `Map3D: (${x}, ${y}, ${z}) is outside the supported range ` +
                `[${MAP_3D_MIN_COORD}, ${MAP_3D_MAX_COORD}] per axis; it wraps around and collides ` +
                `with other coordinates. Further warnings for this map are suppressed.`,
            );
        }

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

    /** Removes every stored cell. */
    clear() {
        this._data.clear();
    }

    /** Value of the cell containing (x, y, z) (coordinates are floored), or `defaultValue` if it isn't stored. */
    get(
        x: number,
        y: number,
        z: number = 0,
    ): number {
        [x, y, z] = this._floor(x, y, z);

        return this._data.get(this._key(x, y, z)) ?? this.defaultValue;
    }

    /** Sets the cell containing (x, y, z) to `n`; leave out `n` (or pass `defaultValue`) to remove it. */
    set(x: number, y: number, z: number, n: number = this.defaultValue) {
        [x, y, z] = this._floor(x, y, z);

        const key = this._key(x, y, z);

        if (n === this.defaultValue) {
            this._data.delete(key);
        } else {
            this._data.set(key, n);
        }
    }

    /**
     * Sets every cell in the box from (x1, y1, z1) to (x2, y2, z2) to `n`; both corners are
     * inclusive and must be the min / max corner (nothing is set if x2 < x1, etc.).
     */
    setArea(
        x1: number, y1: number, z1: number,
        x2: number, y2: number, z2: number,
        n: number,
    ): void {
        for (let z = z1; z <= z2; z++) {
            for (let y = y1; y <= y2; y++) {
                for (let x = x1; x <= x2; x++) {
                    this.set(x, y, z, n);
                }
            }
        }
    }

    /** Calls `callback` for every stored cell, in insertion order. Cells holding the default value are not visited. */
    forEach(callback: (x: number, y: number, z: number, n: number) => void) {
        this._data.forEach((n: number, key: number) => {
            const [x, y, z] = this._pos(key);
            callback(x, y, z, n);
        });
    }

    /** Stored cells as a plain array (e.g. for JSON); the inverse of {@link Map3D.import}. */
    export(): { x: number, y: number, z: number, n: number }[] {
        const data: { x: number, y: number, z: number, n: number }[] = [];

        this.forEach((x: number, y: number, z: number, n: number) => {
            data.push({ x, y, z, n });
        });

        return data;
    }

    /** Replaces the map's contents with cells from {@link Map3D.export} (clears it first). */
    import(data: { x: number, y: number, z: number, n: number }[]) {
        this.clear();

        data.forEach(({ x, y, z, n }: { x: number, y: number, z: number, n: number }) => {
            this.set(x, y, z, n);
        });
    }

    /** Copies every stored cell of a {@link Map2D} into a new map, at z = 0. */
    static fromMap2D(map2d: Map2D, defaultValue: number = DEFAULT_MAP_3D_VALUE): Map3D {
        const map3d = new Map3D(defaultValue);

        map2d.forEach((x: number, y: number, n: number) => map3d.set(x, y, 0, n));

        return map3d;
    }
}
