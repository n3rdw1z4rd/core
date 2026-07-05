export interface SpatialPartitionEntity2d {
    x: number;
    y: number;
}

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

    addEntity(entity: SpatialPartitionEntity2d) {
        const cell = this.getCell(entity.x, entity.y);
        cell.push(entity);
    }

    getCell(x: number, y: number) {
        const cellX = Math.floor(x / this.cellSize);
        const cellY = Math.floor(y / this.cellSize);
        return this.cells[cellY][cellX];
    }

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
