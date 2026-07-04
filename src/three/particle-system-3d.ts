import { BufferGeometry, Float32BufferAttribute, Group, PerspectiveCamera, Points, ShaderMaterial, Vector3 } from 'three';
import { rng } from '../rng';
import { SpatialPartition3d, SpatialPartitionEntity3d } from '../spatial-partition-3d';

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

// 3D "particle life" simulation - see particle-system-2d.ts for the 2D
// version and more detail on the attraction-matrix technique.
export class ParticleSystem3d extends Group {
    public readonly particleCount = 1000;

    private _geometry: BufferGeometry;
    private _particles: Particle[] = [];
    private _frictionHalfLife = 0.04;
    private _range = 0.2;
    private _rangeFactor = 0.1;

    private _attractionMatrix: number[][];

    private _spatialPartition: SpatialPartition3d;

    constructor() {
        super();

        const uniforms = {
            pointSize: { value: 4 },
        };

        this.position.x = -0.5;
        this.position.y = -0.5;
        this.position.z = -0.5;

        this._geometry = new BufferGeometry();
        this._geometry.setAttribute('position', new Float32BufferAttribute([], 3));
        this._geometry.setAttribute('color', new Float32BufferAttribute([], 4));

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
                x: rng.nextf,
                y: rng.nextf,
                z: rng.nextf,
                vx: 0,
                vy: 0,
                vz: 0,
                color: rng.range(Colors.length),
            });
        }

        this._attractionMatrix = rng.randomMatrix(Colors.length);
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

                    for (let i = 0; i < cell.length; i++) {
                        let fx = 0, fy = 0, fz = 0;
                        const p1 = cell[i] as Particle;
                        const neighbors = this._spatialPartition.getCellNeighbors(x, y, z);

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

                        fx *= this._range * this._rangeFactor;
                        fy *= this._range * this._rangeFactor;
                        fz *= this._range * this._rangeFactor;

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

            if (particle.x < 0) particle.x = (particle.x + 1) % 1;
            if (particle.x > 1) particle.x = particle.x % 1;

            if (particle.y < 0) particle.y = (particle.y + 1) % 1;
            if (particle.y > 1) particle.y = particle.y % 1;

            if (particle.z < 0) particle.z = (particle.z + 1) % 1;
            if (particle.z > 1) particle.z = particle.z % 1;

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

    private _sortParticles(camera: PerspectiveCamera) {
        this._particles.sort((a: Particle, b: Particle) => {
            const d1 = camera.position.distanceTo(new Vector3(a.x, a.y, a.z));
            const d2 = camera.position.distanceTo(new Vector3(b.x, b.y, b.z));

            return d1 > d2 ? -1 : d1 > d1 ? 1 : 0;
        });
    }

    private _updateGeometry() {
        const positions = [];
        const colors = [];

        for (const particle of this._particles) {
            positions.push(
                particle.x,
                particle.y,
                particle.z,
            );

            colors.push(
                Colors[particle.color][0],
                Colors[particle.color][1],
                Colors[particle.color][2],
                Colors[particle.color][3],
            );
        }

        this._geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
        this._geometry.setAttribute('color', new Float32BufferAttribute(colors, 4));

        this._geometry.attributes.position.needsUpdate = true;
    }

    public update(camera: PerspectiveCamera, dt: number) {
        this._updateVelocities(dt);
        this._updatePositions(dt);
        this._sortParticles(camera);
        this._updateGeometry();
    }
}
