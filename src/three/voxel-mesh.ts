import { type Material, Mesh, MeshLambertMaterial } from 'three';
import { Map3D } from '../map3d';
import { type BuildVoxelGeometryOptions, VoxelGeometry } from './voxel-geometry';

/**
 * Box of voxel cells a {@link VoxelMesh} accepts, from the origin.
 *
 * @category Voxels
 */
export interface VoxelBounds {
    /** x */
    width: number,
    /** y */
    height: number,
    /** z */
    depth: number,
}

/**
 * Options for the {@link VoxelMesh} constructor; the rest are passed on to {@link VoxelGeometry}.
 *
 * @category Voxels
 */
export interface VoxelMeshOptions extends Omit<BuildVoxelGeometryOptions, 'target'> {
    /** vertexColors is turned on; default: MeshLambertMaterial */
    material?: Material | Material[],
    /** voxels may only be set inside [0, width) x [0, height) x [0, depth) */
    bounds?: VoxelBounds,
    /** existing voxel data to show */
    voxels?: Map3D,
}

/**
 * Editable voxel model: `set()` voxels, then `update()` rebuilds the geometry if anything changed.
 * Voxel values are palette indices; `Map3D`'s default value (-1) means empty.
 *
 * ```ts
 * const model = new VoxelMesh({ palette: [0xff0000, 0x00ff00], bounds: { width: 16, height: 16, depth: 16 } });
 * scene.add(model);
 *
 * model.set(0, 0, 0, 1);
 * model.update(); // rebuilds once, however many voxels changed
 * ```
 *
 * @category Voxels
 */
export class VoxelMesh extends Mesh<VoxelGeometry, Material | Material[]> {
    /** `set()` ignores voxels outside these; undefined = unbounded */
    bounds?: VoxelBounds;

    private _dirty = false;

    /** the geometry's voxel data; call `invalidate()` after changing it directly */
    get voxels(): Map3D { return this.geometry.voxels; }

    /** geometry is out of date with the voxels */
    get needsUpdate(): boolean { return this._dirty; }

    constructor(options: VoxelMeshOptions = {}) {
        const { material, bounds, voxels, ...buildOptions } = options;

        super(new VoxelGeometry(voxels ?? new Map3D(), buildOptions), material ?? new MeshLambertMaterial());

        for (const m of Array.isArray(this.material) ? this.material : [this.material]) {
            m.vertexColors = true;
        }

        this.bounds = bounds;
    }

    /** Whether (x, y, z) is inside `bounds` (always true without bounds). */
    inBounds(x: number, y: number, z: number): boolean {
        if (!this.bounds) return true;

        return x >= 0 && y >= 0 && z >= 0 &&
            x < this.bounds.width && y < this.bounds.height && z < this.bounds.depth;
    }

    /** Voxel value at (x, y, z); the map's default value (-1 unless you passed your own map) if empty. */
    get(x: number, y: number, z: number): number {
        return this.voxels.get(x, y, z);
    }

    /** Sets a voxel; leave out `value` (or pass the default value) to remove it. Ignored outside the bounds. */
    set(x: number, y: number, z: number, value: number = this.voxels.defaultValue): void {
        if (!this.inBounds(x, y, z) || this.voxels.get(x, y, z) === value) return;

        this.voxels.set(x, y, z, value);
        this._dirty = true;
    }

    /** (not `clear()`: that's Object3D's "remove all children") */
    clearVoxels(): void {
        if (this.voxels.size === 0) return;

        this.voxels.clear();
        this._dirty = true;
    }

    /** Call after changing `voxels` directly (or the geometry's options) to force a rebuild. */
    invalidate(): void {
        this._dirty = true;
    }

    /** Rebuilds the geometry if the voxels changed; returns whether it did. */
    update(): boolean {
        if (!this._dirty) return false;

        this.geometry.update();
        this._dirty = false;

        return true;
    }
}
