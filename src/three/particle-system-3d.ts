import { BufferAttribute, BufferGeometry, DynamicDrawUsage, Group, PerspectiveCamera, Points, ShaderMaterial, Sphere, Vector3 } from 'three';
import { Random } from '../random';
import { fract } from '../math';
import { SpatialPartition3d, SpatialPartitionEntity3d } from '../spatial-partition-3d';
import { rng } from '../rng';
import { randomMatrix } from '../particle-system-2d';

const vertexShader = `
uniform float pointSize;

varying vec4 vColor;

void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = pointSize;

    vColor = color;
}`;

const fragmentShader = `
varying vec4 vColor;

void main() {
    gl_FragColor = vColor;
}`;

interface Particle extends SpatialPartitionEntity3d {
    vx: number,
    vy: number,
    vz: number,
    color: number,
}

const Colors = [
    [1, 0, 0, 1], // red
    [0, 1, 0, 1], // green,
    [0, 0, 1, 1], // blue,
    [1, 1, 0, 1], // yellow,
    [1, 0, 1, 1], // magenta,
];

/**
 * "Particle life" simulation in 3D: 1000 colored points in five species that attract or repel each
 * other according to a random species-by-species matrix, forming moving clusters. Particles live in
 * a wrapping unit cube; the group is offset by -0.5 so the cube is centred on its origin (scale it
 * to resize).
 *
 * Neighbours are found with a {@link SpatialPartition3d}. Points are drawn at a fixed 4 pixels and
 * sorted back to front each update.
 *
 * ```ts
 * const life = new ParticleSystem3d(42);
 * life.scale.setScalar(10);
 * scene.add(life);
 *
 * // each frame
 * life.update(camera, deltaTime);
 * ```
 *
 * @category Particles
 */
export class ParticleSystem3d extends Group {
    /** number of particles; fixed */
    public readonly particleCount = 1000;
    /** the seed the starting state came from */
    public readonly seed: number;

    private _geometry: BufferGeometry;
    private _particles: Particle[] = [];
    private _frictionHalfLife = 0.04;
    private _range = 0.2;
    private _forceFactor = 6; // per second; equivalent to the old per-frame factor of 0.1 at 60fps

    private _positions: Float32Array;
    private _colors: Float32Array;
    private _cameraLocal = new Vector3();

    private _attractionMatrix: number[][];

    private _spatialPartition: SpatialPartition3d;

    /** the same seed always produces the same starting state (positions, colors, attraction matrix) */
    constructor(seed: number = rng.nextUint()) {
        super();

        this.seed = seed;

        const uniforms = {
            pointSize: { value: 4 },
        };

        this.position.x = -0.5;
        this.position.y = -0.5;
        this.position.z = -0.5;

        this._positions = new Float32Array(this.particleCount * 3);
        this._colors = new Float32Array(this.particleCount * 4);

        this._geometry = new BufferGeometry();
        this._geometry.setAttribute('position', new BufferAttribute(this._positions, 3).setUsage(DynamicDrawUsage));
        this._geometry.setAttribute('color', new BufferAttribute(this._colors, 4).setUsage(DynamicDrawUsage));

        // particles always stay inside the unit cube, so the bounds never change
        this._geometry.boundingSphere = new Sphere(new Vector3(0.5, 0.5, 0.5), Math.sqrt(3) / 2);

        const material = new ShaderMaterial({
            uniforms,
            vertexShader,
            fragmentShader,
            depthTest: true,
            depthWrite: false,
            vertexColors: true,
        });

        const pointsMesh = new Points(this._geometry, material);
        this.add(pointsMesh);

        for (let i = 0; i < this.particleCount; i++) {
            this._particles.push({
                x: Random.float(seed, i, 0),
                y: Random.float(seed, i, 1),
                z: Random.float(seed, i, 2),
                vx: 0,
                vy: 0,
                vz: 0,
                color: Math.floor(Random.float(seed, i, 3) * Colors.length),
            });
        }

        this._attractionMatrix = randomMatrix(Colors.length, seed);
        this._spatialPartition = new SpatialPartition3d(this._range, this._particles);
    }

    private _calcForce(r: number, a: number, beta: number = 0.3): number {
        let f = 0;

        if (r < beta) {
            f = r / beta - 1;
        } else if (beta < r && r < 1) {
            f = a * (1 - Math.abs(2 * r - 1 - beta) / (1 - beta));
        }

        return f;
    }

    private _updateVelocities(dt: number) {
        const frictionFactor: number = Math.pow(
            0.5,
            dt / this._frictionHalfLife,
        );

        for (let z = 0; z < this._spatialPartition.cells.length; z++) {
            for (let y = 0; y < this._spatialPartition.cells[z].length; y++) {
                for (let x = 0; x < this._spatialPartition.cells[z][y].length; x++) {
                    const cell = this._spatialPartition.cells[z][y][x];
                    const neighbors = this._spatialPartition.getCellNeighbors(x, y, z);

                    for (let i = 0; i < cell.length; i++) {
                        let fx = 0, fy = 0, fz = 0;
                        const p1 = cell[i] as Particle;

                        for (const neighborCell of neighbors) {
                            for (let j = 0; j < neighborCell.length; j++) {
                                if (cell === neighborCell && i === j) continue;
                                const p2 = neighborCell[j] as Particle;

                                let dx = p2.x - p1.x;
                                let dy = p2.y - p1.y;
                                let dz = p2.z - p1.z;

                                if (Math.abs(dx) > 0.5) dx = dx > 0 ? dx - 1 : dx + 1;
                                if (Math.abs(dy) > 0.5) dy = dy > 0 ? dy - 1 : dy + 1;
                                if (Math.abs(dz) > 0.5) dz = dz > 0 ? dz - 1 : dz + 1;

                                const dist = Math.hypot(dx, dy, dz);

                                if (dist > 0 && dist < this._range) {
                                    const f = this._calcForce(dist / this._range, this._attractionMatrix[p1.color][p2.color]);
                                    fx += (dx / dist) * f;
                                    fy += (dy / dist) * f;
                                    fz += (dz / dist) * f;
                                }
                            }
                        }

                        // scale by dt so the simulation runs at the same speed regardless of frame rate
                        const scale = this._range * this._forceFactor * dt;

                        fx *= scale;
                        fy *= scale;
                        fz *= scale;

                        p1.vx *= frictionFactor;
                        p1.vy *= frictionFactor;
                        p1.vz *= frictionFactor;

                        p1.vx += fx;
                        p1.vy += fy;
                        p1.vz += fz;
                    }
                }
            }
        }
    }

    private _updatePositions(dt: number) {
        for (let i = 0; i < this._particles.length; i++) {
            const particle = this._particles[i];
            const oldCell = this._spatialPartition.getCell(particle.x, particle.y, particle.z);

            particle.x += particle.vx * dt;
            particle.y += particle.vy * dt;
            particle.z += particle.vz * dt;

            // wrap into [0, 1) - the old checks let exactly 1.0 through
            particle.x = fract(particle.x);
            particle.y = fract(particle.y);
            particle.z = fract(particle.z);

            const newCell = this._spatialPartition.getCell(particle.x, particle.y, particle.z);

            if (newCell !== oldCell) {
                const index = oldCell.indexOf(particle);

                if (index !== -1) {
                    oldCell.splice(index, 1);
                }

                newCell.push(particle);
            }
        }
    }

    // back-to-front, measured in this group's local space (particles live in [0, 1)^3)
    private _sortParticles(camera: PerspectiveCamera) {
        const c = this.worldToLocal(camera.getWorldPosition(this._cameraLocal));

        const distanceSq = (p: Particle) => (p.x - c.x) ** 2 + (p.y - c.y) ** 2 + (p.z - c.z) ** 2;

        this._particles.sort((a: Particle, b: Particle) => distanceSq(b) - distanceSq(a));
    }

    private _updateGeometry() {
        for (let i = 0; i < this._particles.length; i++) {
            const particle = this._particles[i];
            const color = Colors[particle.color];

            this._positions[i * 3] = particle.x;
            this._positions[i * 3 + 1] = particle.y;
            this._positions[i * 3 + 2] = particle.z;

            this._colors.set(color, i * 4);
        }

        this._geometry.attributes.position.needsUpdate = true;
        this._geometry.attributes.color.needsUpdate = true;
    }

    /**
     * Advances the simulation by `dt` seconds and refreshes the points, sorted back to front as
     * seen from `camera`.
     */
    public update(camera: PerspectiveCamera, dt: number) {
        this._updateVelocities(dt);
        this._updatePositions(dt);
        this._sortParticles(camera);
        this._updateGeometry();
    }
}
