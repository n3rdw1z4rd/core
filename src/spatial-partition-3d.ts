import { mod } from './math';

/**
 * Anything with a position that a {@link SpatialPartition3d} can bucket.
 *
 * @category Maps & Spatial
 */
export interface SpatialPartitionEntity3d {
    /** in [0, 1) */
    x: number;
    /** in [0, 1) */
    y: number;
    /** in [0, 1) */
    z: number;
}

/**
 * Uniform grid over the wrapping unit cube [0, 1)³, for finding nearby entities without comparing
 * every pair. The grid has `ceil(1 / cellSize)` cells per axis.
 *
 * Entities are bucketed by position when added; the partition doesn't track movement, so move an
 * entity between cells yourself (see {@link SpatialPartition3d.getCell}) when it changes cell.
 *
 * @category Maps & Spatial
 */
export class SpatialPartition3d {
    /** buckets, indexed `cells[cellZ][cellY][cellX]` */
    cells: SpatialPartitionEntity3d[][][][];
    /** cell edge length in unit-cube units, e.g. 0.2 for a 5 x 5 x 5 grid */
    cellSize: number;
    /** the array passed to the constructor; `addEntity()` doesn't add to it */
    entities: SpatialPartitionEntity3d[];

    /** Builds the grid and adds every entity in `entities`. */
    constructor(cellSize: number, entities: SpatialPartitionEntity3d[]) {
        this.cellSize = cellSize;
        this.entities = entities;

        const gridSize = Math.ceil(1.0 / cellSize);

        this.cells = Array.from({ length: gridSize }, () =>
            Array.from({ length: gridSize }, () =>
                Array.from({ length: gridSize }, () => [])
            )
        );

        for (const entity of this.entities) {
            this.addEntity(entity);
        }
    }

    /** positions are expected in [0, 1); anything outside wraps around, matching getCellNeighbors */
    getCell(x: number, y: number, z: number) {
        const gridSize = this.cells.length;

        const cx = mod(Math.floor(x / this.cellSize), gridSize);
        const cy = mod(Math.floor(y / this.cellSize), gridSize);
        const cz = mod(Math.floor(z / this.cellSize), gridSize);

        return this.cells[cz][cy][cx];
    }

    /**
     * The 3 x 3 x 3 block of cells around cell (`cx`, `cy`, `cz`), including that cell, wrapping at
     * the edges. Takes cell indices, not positions; with fewer than 3 cells per axis some cells
     * appear more than once.
     */
    getCellNeighbors(cx: number, cy: number, cz: number) {
        const neighbors = [];
        const gridSize = this.cells.length;

        for (let dz = -1; dz <= 1; dz++) {
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    let nx = (cx + dx + gridSize) % gridSize;
                    let ny = (cy + dy + gridSize) % gridSize;
                    let nz = (cz + dz + gridSize) % gridSize;

                    neighbors.push(this.cells[nz][ny][nx]);
                }
            }
        }

        return neighbors;
    }

    /** Puts `entity` in the cell its current position falls in. */
    addEntity(entity: SpatialPartitionEntity3d) {
        const cell = this.getCell(entity.x, entity.y, entity.z);

        cell.push(entity);
    }
}
