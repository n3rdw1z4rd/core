import { BoxGeometry, Vector3 } from 'three';
import { Noise } from '../noise';

/**
 * A `BoxGeometry` whose vertices are normalized and pushed back out to a
 * sphere of the same size - the classic "cube sphere" trick for
 * near-uniform quad distribution (unlike `SphereGeometry`'s pole pinching).
 * Call {@link applyFractalBrownianMotion} afterward to turn it into a
 * planet-like terrain mesh.
 */
export class CubeSphereGeometry extends BoxGeometry {
    private _halfSize: number;

    constructor(
        public readonly size: number,
        public readonly segments: number,
    ) {
        size = Math.floor(size);
        segments = Math.floor(segments);

        super(size, size, size, segments, segments, segments);

        this._halfSize = (this.size / 2);

        const attrPositions = this.attributes.position;
        const position = new Vector3();

        for (let i = 0; i < attrPositions.count; i++) {
            position.fromBufferAttribute(attrPositions, i);
            position.normalize().multiplyScalar(this._halfSize);
            attrPositions.setXYZ(i, position.x, position.y, position.z);
        }

        attrPositions.needsUpdate = true;
    }

    /** Displaces every vertex radially by layered ({@link fBm}) 3D simplex noise sampled at world position * `scale`, scaled by `amplitude` - turns the sphere into rough terrain. */
    applyFractalBrownianMotion(octaves: number, persistence: number, scale: number, amplitude: number) {
        const attrPositions = this.attributes.position;
        const position = new Vector3();

        for (let i = 0; i < attrPositions.count; i++) {
            position.fromBufferAttribute(attrPositions, i);
            position.normalize().multiplyScalar(this._halfSize);

            const noiseValue = this.fBm(position.x * scale, position.y * scale, position.z * scale, octaves, persistence);
            position.addScaledVector(position.clone().normalize(), noiseValue * amplitude);

            attrPositions.setXYZ(i, position.x, position.y, position.z);
        }

        attrPositions.needsUpdate = true;
    }

    /** Fractal Brownian motion: sums `octaves` layers of 3D simplex noise at doubling frequency and `persistence`-scaled amplitude, normalized to roughly `[-1, 1]`. */
    private fBm(x: number, y: number, z: number, octaves: number, persistence: number): number {
        let total = 0;
        let frequency = 1;
        let amplitude = 1;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            total += Noise.noise3d(x * frequency, y * frequency, z * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= 2;
        }

        return total / maxValue;
    }
}
