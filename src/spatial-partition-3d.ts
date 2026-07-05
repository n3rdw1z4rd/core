/** Minimal shape a {@link SpatialPartition3d} entity must have - just a position. */
export interface SpatialPartitionEntity3d {
    x: number;
    y: number;
    z: number;
}

/** 3D counterpart to {@link SpatialPartition2d} - see its docs for the normalized-coordinate and wraparound behavior. */
export class SpatialPartition3d {
    cells: SpatialPartitionEntity3d[][][][];
    cellSize: number;
    entities: SpatialPartitionEntity3d[];

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

    /** Returns the cell (list of entities) containing world position `(x, y, z)`. */
    getCell(x: number, y: number, z: number) {
        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);
        const cz = Math.floor(z / this.cellSize);

        return this.cells[cz][cy][cx];
    }

    /** Returns the 26 neighboring cells around cell coordinates `(cx, cy, cz)`, wrapping around the grid edges. */
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

    /** Adds an entity to the cell matching its current position. */
    addEntity(entity: SpatialPartitionEntity3d) {
        const cell = this.getCell(entity.x, entity.y, entity.z);

        cell.push(entity);
    }
}
