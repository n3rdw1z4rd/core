/** Minimal shape a {@link SpatialPartition2d} entity must have - just a position. */
export interface SpatialPartitionEntity2d {
    x: number;
    y: number;
}

/**
 * Uniform grid spatial partition for fast neighbor queries over 2D
 * entities, assuming positions are normalized to `[0, 1)` (the grid spans
 * exactly one unit square, divided into `cellSize`-sized cells). Cell
 * lookups wrap around at the grid edges rather than clamping.
 */
export class SpatialPartition2d {
    cells: SpatialPartitionEntity2d[][][];
    cellSize: number;
    entities: SpatialPartitionEntity2d[];

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

    /** Adds an entity to the cell matching its current position. */
    addEntity(entity: SpatialPartitionEntity2d) {
        const cell = this.getCell(entity.x, entity.y);
        cell.push(entity);
    }

    /** Returns the cell (list of entities) containing world position `(x, y)`. */
    getCell(x: number, y: number) {
        const cellX = Math.floor(x / this.cellSize);
        const cellY = Math.floor(y / this.cellSize);
        return this.cells[cellY][cellX];
    }

    /** Returns the 8 neighboring cells around cell coordinates `(x, y)`, wrapping around the grid edges. */
    getCellNeighbors(x: number, y: number) {
        const neighbors = [];

        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                let nx = x + dx;
                let ny = y + dy;

                // Wrap around if out of bounds
                if (nx < 0) nx = this.cells[0].length - 1;
                else if (nx >= this.cells[0].length) nx = 0;

                if (ny < 0) ny = this.cells.length - 1;
                else if (ny >= this.cells.length) ny = 0;

                neighbors.push(this.cells[ny][nx]);
            }
        }

        return neighbors;
    }
}
