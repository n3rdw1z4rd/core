import { Color } from './color';
import { Renderer } from './particle-renderer';
import { rng } from './rng';
import { SpatialPartition2d, SpatialPartitionEntity2d } from './spatial-partition-2d';

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

/**
 * "Particle life" simulation: particles attract/repel each other based on a
 * randomized per-color attraction matrix, producing emergent clustering/
 * swarming behavior. `cellSize` (`_range`) drives a {@link SpatialPartition2d}
 * so force calculation only looks at nearby particles instead of all-pairs.
 * Draws through a {@link Renderer}; call {@link update} once per frame.
 */
export class ParticleSystem2d {
    public readonly particleCount = 2000;

    private _particleSize = 2;
    private _frictionHalfLife = 0.04;
    private _range = 0.1;
    private _rangeFactor = 0.1;

    private _attractionMatrix: number[][] = rng.randomMatrix(colors.length);
    private _particles: Particle[] = [];

    private _spatialPartition: SpatialPartition2d;

    constructor() {
        for (let i = 0; i < this.particleCount; i++) {
            this._particles.push({
                x: rng.nextf,
                y: rng.nextf,
                vx: 0,
                vy: 0,
                color: rng.range(colors.length),
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

                for (let i = 0; i < cell.length; i++) {
                    let fx: number = 0;
                    let fy: number = 0;

                    const p1: Particle = cell[i] as Particle;

                    // Get neighboring cells
                    const neighborCells = this._spatialPartition.getCellNeighbors(x, y);

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

                    fx *= this._range * this._rangeFactor;
                    fy *= this._range * this._rangeFactor;

                    p1.vx *= frictionFactor;
                    p1.vy *= frictionFactor;

                    p1.vx += fx;
                    p1.vy += fy;
                }
            }
        }
    };

    private _updatePositions(deltaTimeSeconds: number, renderer: Renderer) {
        for (let i = 0; i < this.particleCount; i++) {
            const particle = this._particles[i];
            const oldCell = this._spatialPartition.getCell(particle.x, particle.y);

            particle.x += particle.vx * deltaTimeSeconds;
            particle.y += particle.vy * deltaTimeSeconds;

            if (particle.x < 0) particle.x = 1 + (particle.x % 1);
            if (particle.x > 1) particle.x = particle.x % 1;

            if (particle.y < 0) particle.y = 1 + (particle.y % 1);
            if (particle.y > 1) particle.y = particle.y % 1;

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

    /** Advances the simulation by `dt` seconds and draws each particle into `renderer`. Call once per frame. */
    public update(renderer: Renderer, dt: number) {
        this._updateVelocities(dt);
        this._updatePositions(dt, renderer);
    }
}
