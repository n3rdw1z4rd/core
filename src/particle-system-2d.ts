import { Color } from './color';
import { fract } from './math';
import { rng } from './rng';
import { SpatialPartition2d, SpatialPartitionEntity2d } from './spatial-partition-2d';
import { Random } from './random';
import { ParticleRenderer } from './particle-renderer';

/** attraction matrix in [-1, 1); seeded from `seed` so it can be reproduced */
export function randomMatrix(size: number, seed: number = 0): number[][] {
    const rows: number[][] = [];

    for (let i = 0; i < size; i++) {
        const row: number[] = [];

        for (let j = 0; j < size; j++) {
            row.push(Random.float(seed, i, j) * 2 - 1);
        }

        rows.push(row);
    }

    return rows;
}

interface Particle extends SpatialPartitionEntity2d {
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: number;
}

const colors: Color[] = [
    Color.RED,
    Color.GREEN,
    Color.BLUE,
    Color.YELLOW,
    Color.MAGENTA,
];

export class ParticleSystem2d {
    public readonly particleCount = 2000;
    public readonly seed: number;

    private _particleSize = 2;
    private _frictionHalfLife = 0.04;
    private _range = 0.1;
    private _forceFactor = 6; // per second; equivalent to the old per-frame factor of 0.1 at 60fps

    private _attractionMatrix: number[][];
    private _particles: Particle[] = [];

    private _spatialPartition: SpatialPartition2d;

    /** the same seed always produces the same starting state (positions, colors, attraction matrix) */
    constructor(seed: number = rng.nextUint()) {
        this.seed = seed;
        this._attractionMatrix = randomMatrix(colors.length, seed);

        for (let i = 0; i < this.particleCount; i++) {
            this._particles.push({
                x: Random.float(seed, i, 0),
                y: Random.float(seed, i, 1),
                vx: 0,
                vy: 0,
                color: Math.floor(Random.float(seed, i, 2) * colors.length),
            });
        }

        this._spatialPartition = new SpatialPartition2d(this._range, this._particles);
    }

    private _calcForce(r: number, a: number, beta: number = 0.3): number {
        let f = 0;

        if (r < beta) {
            f = r / beta - 1;
        } else if (beta < r && r < 1) {
            f = a * (1 - Math.abs(2 * r - 1 - beta) / (1 - beta));
        }

        return f;
    };

    private _updateVelocities(deltaTimeSeconds: number) {
        const frictionFactor: number = Math.pow(
            0.5,
            deltaTimeSeconds / this._frictionHalfLife,
        );

        for (let y = 0; y < this._spatialPartition.cells.length; y++) {
            for (let x = 0; x < this._spatialPartition.cells[y].length; x++) {
                const cell = this._spatialPartition.cells[y][x];
                const neighborCells = this._spatialPartition.getCellNeighbors(x, y);

                for (let i = 0; i < cell.length; i++) {
                    let fx: number = 0;
                    let fy: number = 0;

                    const p1: Particle = cell[i] as Particle;

                    // Check particles in the same and neighboring cells
                    for (const neighborCell of neighborCells) {
                        for (let j = 0; j < neighborCell.length; j++) {
                            if (cell === neighborCell && i === j) continue;

                            const p2: Particle = neighborCell[j] as Particle;

                            let rx: number = p2.x - p1.x;
                            if (Math.abs(rx) > 0.5) rx = rx > 0 ? rx - 1 : rx + 1;

                            let ry: number = p2.y - p1.y;
                            if (Math.abs(ry) > 0.5) ry = ry > 0 ? ry - 1 : ry + 1;

                            const d: number = Math.hypot(rx, ry);

                            if (d > 0 && d < this._range) {
                                const f: number = this._calcForce(
                                    d / this._range,
                                    this._attractionMatrix[p1.color][p2.color],
                                );

                                fx += (rx / d) * f;
                                fy += (ry / d) * f;
                            }
                        }
                    }

                    // scale by dt so the simulation runs at the same speed regardless of frame rate
                    fx *= this._range * this._forceFactor * deltaTimeSeconds;
                    fy *= this._range * this._forceFactor * deltaTimeSeconds;

                    p1.vx *= frictionFactor;
                    p1.vy *= frictionFactor;

                    p1.vx += fx;
                    p1.vy += fy;
                }
            }
        }
    };

    private _updatePositions(deltaTimeSeconds: number, renderer: ParticleRenderer) {
        for (let i = 0; i < this.particleCount; i++) {
            const particle = this._particles[i];
            const oldCell = this._spatialPartition.getCell(particle.x, particle.y);

            particle.x += particle.vx * deltaTimeSeconds;
            particle.y += particle.vy * deltaTimeSeconds;

            // wrap into [0, 1) - the old checks let exactly 1.0 through
            particle.x = fract(particle.x);
            particle.y = fract(particle.y);

            renderer.setPixel(
                particle.x * renderer.width,
                particle.y * renderer.height,
                colors[particle.color],
                this._particleSize,
            );

            const newCell = this._spatialPartition.getCell(particle.x, particle.y);

            if (newCell !== oldCell) {
                const index = oldCell.indexOf(particle);
                if (index !== -1) {
                    oldCell.splice(index, 1);
                }
                newCell.push(particle);
            }
        }
    };

    public update(renderer: ParticleRenderer, dt: number) {
        this._updateVelocities(dt);
        this._updatePositions(dt, renderer);
    }
}
