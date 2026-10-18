import { IcosahedronGeometry, Mesh, MeshStandardMaterial } from 'three';
import type { NoiseFunction3D } from '../types';

/**
 * Options for the {@link AsteroidMesh} constructor.
 *
 * @category Geometry & Meshes
 */
export interface AsteroidOptions {
    /** shapes the surface; expected to return roughly -1..1 */
    noise3d: NoiseFunction3D;
    /** base radius before displacement, default 1 */
    radius?: number;
    /** IcosahedronGeometry subdivision level, default 1 */
    detail?: number;
    /** noise frequency: vertex positions are multiplied by this before sampling, default 1 */
    noiseScale?: number;
    /** each vertex moves by `noise * displacement` times its distance from the center, default 0.1 */
    displacement?: number;
    /** optional extra detail layer, sampled at twice the frequency and half the weight */
    secondaryNoise?: NoiseFunction3D;
    /** 0xRRGGBB, default 0x888888 */
    color?: number;
}

/**
 * Lumpy rock: an icosphere whose vertices are pushed in and out by 3D noise, with a
 * `MeshStandardMaterial`. The geometry is non-indexed, so normals are per face (a faceted look).
 * Deterministic for a deterministic noise function.
 *
 * ```ts
 * import { createNoise3D } from 'simplex-noise';
 *
 * const rock = new AsteroidMesh({ noise3d: createNoise3D(() => rng.nextFloat()), radius: 2, detail: 3, displacement: 0.25 });
 * ```
 *
 * @category Geometry & Meshes
 */
export class AsteroidMesh extends Mesh {
    constructor(options: AsteroidOptions) {
        const radius = options.radius ?? 1;
        const detail = options.detail ?? 1;
        const noiseScale = options.noiseScale ?? 1.0;
        const displacement = options.displacement ?? 0.1;
        const noise3d = options.noise3d;
        const noise3d2 = options.secondaryNoise;
        const color = options.color ?? 0x888888;

        const geometry = new IcosahedronGeometry(radius, detail);
        const material = new MeshStandardMaterial({ color });

        super(geometry, material);

        const position = this.geometry.attributes.position;
        const vertices = position.array;

        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i];
            const y = vertices[i + 1];
            const z = vertices[i + 2];

            const n1 = noise3d(x * noiseScale, y * noiseScale, z * noiseScale);
            const n2 = noise3d2
                ? 0.5 * noise3d2(x * noiseScale * 2, y * noiseScale * 2, z * noiseScale * 2)
                : 0;

            const noiseValue = n1 + n2;
            const displacementValue = 1 + noiseValue * displacement;

            vertices[i] = x * displacementValue;
            vertices[i + 1] = y * displacementValue;
            vertices[i + 2] = z * displacementValue;
        }

        position.needsUpdate = true;
        this.geometry.computeVertexNormals();
    }
}
