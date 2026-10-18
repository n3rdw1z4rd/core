import { mod } from './math';

/**
 * Anything with a position that a {@link SpatialPartition2d} can bucket.
 *
 * @category Maps & Spatial
 */
export interface SpatialPartitionEntity2d {
    /** in [0, 1) */
    x: number;
    /** in [0, 1) */
    y: number;
}

/**
 * Uniform grid over the wrapping unit square [0, 1)², for finding nearby entities without
 * comparing every pair. The grid has `ceil(1 / cellSize)` cells per axis.
 *
 * Entities are bucketed by position when added; the partition doesn't track movement, so move an
 * entity between cells yourself (see {@link SpatialPartition2d.getCell}) when it changes cell.
 *
 * @category Maps & Spatial
 */
export class SpatialPartition2d {
    /** buckets, indexed `cells[cellY][cellX]` */
    cells: SpatialPartitionEntity2d[][][];
    /** cell edge length in unit-square units, e.g. 0.1 for a 10 x 10 grid */
    cellSize: number;
    /** the array passed to the constructor; `addEntity()` doesn't add to it */
    entities: SpatialPartitionEntity2d[];

    /** Builds the grid and adds every entity in `entities`. */
    constructor(cellSize: number, entities: SpatialPartitionEntity2d[]) {
        this.cellSize = cellSize;
        this.entities = entities;

        this.cells = Array.from({ length: Math.ceil(1.0 / cellSize) }, () =>
            Array.from({ length: Math.ceil(1.0 / cellSize) }, () => [])
        );

        for (const entity of this.entities) {
            this.addEntity(entity);
        }
    }

    /** Puts `entity` in the cell its current position falls in. */
    addEntity(entity: SpatialPartitionEntity2d) {
        const cell = this.getCell(entity.x, entity.y);
        cell.push(entity);
    }

    /** positions are expected in [0, 1); anything outside wraps around, matching getCellNeighbors */
    getCell(x: number, y: number) {
        const cellX = mod(Math.floor(x / this.cellSize), this.cells[0].length);
        const cellY = mod(Math.floor(y / this.cellSize), this.cells.length);
        return this.cells[cellY][cellX];
    }

    /**
     * The 3 x 3 block of cells around cell (`x`, `y`), including that cell, wrapping at the edges.
     * Takes cell indices, not positions. Each cell appears once, so with fewer than 3 cells per
     * axis the block has fewer than 9 cells.
     */
    getCellNeighbors(x: number, y: number) {
        const neighbors = new Set<SpatialPartitionEntity2d[]>(); // insertion-ordered, de-duplicated

        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const nx = mod(x + dx, this.cells[0].length);
                const ny = mod(y + dy, this.cells.length);

                neighbors.add(this.cells[ny][nx]);
            }
        }

        return [...neighbors];
    }
}
