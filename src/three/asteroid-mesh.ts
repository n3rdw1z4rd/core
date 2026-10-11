import { IcosahedronGeometry, Mesh, MeshStandardMaterial } from 'three';
import type { NoiseFunction3D } from '../types';

export interface AsteroidOptions {
    noise3d: NoiseFunction3D;
    radius?: number;
    detail?: number;
    noiseScale?: number;
    displacement?: number;
    secondaryNoise?: NoiseFunction3D; // optional extra detail layer, sampled at twice the frequency and half the weight
    color?: number;
}

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
