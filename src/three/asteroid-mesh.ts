import { IcosahedronGeometry, Mesh, MeshStandardMaterial } from 'three';
import { createNoise3D } from 'simplex-noise';
import { rng } from '../rng';

/** Options for {@link AsteroidMesh}. */
export interface AsteroidOptions {
    radius?: number;
    /** Icosahedron subdivision level - higher gives smoother, more detailed noise displacement. */
    detail?: number;
    noiseScale?: number;
    /** How strongly noise displaces each vertex, as a fraction of `radius`. */
    displacement?: number;
    /** Adds a second, higher-frequency noise layer for extra surface detail. */
    secondaryNoise?: boolean;
    color?: number;
}

/**
 * Procedurally-lumpy rock mesh: starts from an `IcosahedronGeometry` and
 * displaces each vertex along its normal by 3D simplex noise, giving a
 * cheap asteroid/rock look without needing hand-authored geometry.
 */
export class AsteroidMesh extends Mesh {
    constructor(options: AsteroidOptions = {}) {
        const radius = options.radius ?? 1;
        const detail = options.detail ?? 1;
        const noiseScale = options.noiseScale ?? 1.0;
        const displacement = options.displacement ?? 0.1;
        const secondaryNoise = options.secondaryNoise ?? false;
        const color = options.color ?? 0x888888;

        const geometry = new IcosahedronGeometry(radius, detail);
        const material = new MeshStandardMaterial({ color });

        super(geometry, material);

        const noise3d = createNoise3D(() => rng.nextf);
        const noise3d2 = secondaryNoise ? createNoise3D(() => rng.nextf) : null;

        const position = this.geometry.attributes.position;
        const vertices = position.array;

        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i];
            const y = vertices[i + 1];
            const z = vertices[i + 2];

            const n1 = noise3d(x * noiseScale, y * noiseScale, z * noiseScale);
            const n2 = secondaryNoise
                ? 0.5 * noise3d2!(x * noiseScale * 2, y * noiseScale * 2, z * noiseScale * 2)
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
