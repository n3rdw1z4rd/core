import { BufferAttribute, BufferGeometry } from 'three';
import type { NoiseFunction3D } from '../types';

// each face: outward normal `n` and tangents `u`, `v` with u × v = n, so (u, v)-CCW triangles face outward
const FACES: readonly { n: readonly number[], u: readonly number[], v: readonly number[] }[] = [
    { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },  // +X
    { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },  // -X
    { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },  // +Y
    { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },  // -Y
    { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },   // +Z
    { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] }, // -Z
];

/**
 * A sphere built from a subdivided cube, for planets and other displaced spheres.
 *
 * Vertices on the cube's edges and corners are shared between faces, so there are no seams:
 * displacement and computed normals are continuous across the whole surface. Points are
 * mapped from cube to sphere with the "spherified cube" mapping, which spaces vertices far
 * more evenly than normalizing (no bunching at the face corners).
 *
 * The geometry has positions, normals and an index; it has no UVs, since one set of UVs can't
 * wrap a sphere without seams (use triplanar mapping or vertex colors for surfaces).
 */
export class CubeSphereGeometry extends BufferGeometry {
    readonly type: string = 'CubeSphereGeometry';

    readonly radius: number;

    // unit direction of every vertex; displacement always starts from these, so it doesn't accumulate
    private readonly _directions: Float32Array;

    /**
     * @param size diameter of the sphere
     * @param segments subdivisions along each cube edge
     */
    constructor(
        public readonly size: number,
        public readonly segments: number,
    ) {
        super();

        segments = Math.max(1, Math.floor(segments));

        this.segments = segments;
        this.radius = size / 2;

        const directions: number[] = [];
        const indices: number[] = [];
        const shared = new Map<string, number>(); // integer lattice position -> vertex index

        for (const { n, u, v } of FACES) {
            const faceIndices: number[] = [];

            for (let j = 0; j <= segments; j++) {
                for (let i = 0; i <= segments; i++) {
                    // integer lattice coordinates in [-segments, segments]: exact, so shared edge
                    // points from neighbouring faces produce the same key
                    const s = 2 * i - segments;
                    const t = 2 * j - segments;

                    const X = n[0] * segments + u[0] * s + v[0] * t;
                    const Y = n[1] * segments + u[1] * s + v[1] * t;
                    const Z = n[2] * segments + u[2] * s + v[2] * t;

                    const key = `${X},${Y},${Z}`;
                    let index = shared.get(key);

                    if (index === undefined) {
                        index = directions.length / 3;
                        shared.set(key, index);
                        directions.push(...CubeSphereGeometry.spherify(X / segments, Y / segments, Z / segments));
                    }

                    faceIndices.push(index);
                }
            }

            const row = segments + 1;

            for (let j = 0; j < segments; j++) {
                for (let i = 0; i < segments; i++) {
                    const a = faceIndices[j * row + i];
                    const b = faceIndices[j * row + i + 1];
                    const c = faceIndices[(j + 1) * row + i + 1];
                    const d = faceIndices[(j + 1) * row + i];

                    indices.push(a, b, c, a, c, d);
                }
            }
        }

        this._directions = new Float32Array(directions);

        this.setIndex(indices);
        this.setAttribute('position', new BufferAttribute(new Float32Array(directions.length), 3));
        this.setAttribute('normal', new BufferAttribute(new Float32Array(directions.length), 3));

        this.displace(() => 0);

        // an undisplaced sphere's exact normal is its direction; computeVertexNormals() only approximates it
        (this.attributes.normal.array as Float32Array).set(this._directions);
    }

    /**
     * Sets each vertex to `radius + height(direction)` along its direction from the center,
     * then recomputes normals and bounds. Always starts from the undisplaced sphere, so calling
     * it again replaces the previous displacement rather than adding to it.
     *
     * @param height offset in world units for the unit direction (x, y, z)
     */
    displace(height: (x: number, y: number, z: number) => number): this {
        const positions = this.attributes.position.array as Float32Array;
        const d = this._directions;

        for (let i = 0; i < d.length; i += 3) {
            const r = this.radius + height(d[i], d[i + 1], d[i + 2]);

            positions[i] = d[i] * r;
            positions[i + 1] = d[i + 1] * r;
            positions[i + 2] = d[i + 2] * r;
        }

        this.attributes.position.needsUpdate = true;

        this.computeVertexNormals();
        this.computeBoundingSphere();

        return this;
    }

    /**
     * Displaces the surface with fractal Brownian motion. Noise is sampled at the undisplaced
     * surface point times `scale`; the summed octaves are normalized to the noise's range and
     * multiplied by `amplitude`.
     */
    applyFractalBrownianMotion(noise3d: NoiseFunction3D, octaves: number, persistence: number, scale: number, amplitude: number): this {
        const r = this.radius * scale;

        return this.displace((x, y, z) => CubeSphereGeometry.fBm(noise3d, x * r, y * r, z * r, octaves, persistence) * amplitude);
    }

    private static fBm(noise3d: NoiseFunction3D, x: number, y: number, z: number, octaves: number, persistence: number): number {
        let total = 0;
        let frequency = 1;
        let amplitude = 1;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            total += noise3d(x * frequency, y * frequency, z * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= 2;
        }

        return total / maxValue;
    }

    /**
     * maps a point on the [-1, 1] cube onto the unit sphere with even spacing
     * (https://mathproofs.blogspot.com/2005/07/mapping-cube-to-sphere.html)
     */
    static spherify(x: number, y: number, z: number): [number, number, number] {
        const x2 = x * x;
        const y2 = y * y;
        const z2 = z * z;

        return [
            x * Math.sqrt(1 - y2 / 2 - z2 / 2 + (y2 * z2) / 3),
            y * Math.sqrt(1 - z2 / 2 - x2 / 2 + (z2 * x2) / 3),
            z * Math.sqrt(1 - x2 / 2 - y2 / 2 + (x2 * y2) / 3),
        ];
    }
}
