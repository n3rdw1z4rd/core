import { createNoise2D, createNoise3D, createNoise4D, NoiseFunction2D, NoiseFunction3D, NoiseFunction4D } from 'simplex-noise';
import { rng } from './rng';

export interface FractalParams {
    octaves: number;
    frequency: number;
    persistence: number;
    amplitude: number;
    lacunarity: number;
}

export class Noise {
    private static _n2d: NoiseFunction2D;
    private static _n3d: NoiseFunction3D;
    private static _n4d: NoiseFunction4D;

    public static noise2d(x: number, y: number): number {
        if (!Noise._n2d) {
            Noise._n2d = createNoise2D(() => rng.nextf);
        }

        return Noise._n2d(x, y);
    }

    public static noise3d(x: number, y: number, z: number): number {
        if (!Noise._n3d) {
            Noise._n3d = createNoise3D(() => rng.nextf);
        }

        return Noise._n3d(x, y, z);
    }

    public static noise4d(x: number, y: number, z: number, w: number): number {
        if (!Noise._n4d) {
            Noise._n4d = createNoise4D(() => rng.nextf);
        }

        return Noise._n4d(x, y, z, w);
    }

    public static fractal2d(x: number, y: number, fractalParams: FractalParams): number {
        const octaves = fractalParams.octaves;
        const lacunarity = fractalParams.lacunarity;
        const gain = 0.5;

        let amplitude = fractalParams.amplitude;
        let frequency = fractalParams.frequency;

        let value = 0;

        for (let i = 0; i < octaves; i++) {
            value += amplitude * Noise.noise2d(
                frequency * x,
                frequency * y,
            );

            frequency *= lacunarity;
            amplitude *= gain;
        }

        return value;
    }

    public static fractal3d(x: number, y: number, z: number, fractalParams: FractalParams): number {
        const octaves = fractalParams.octaves;
        const lacunarity = fractalParams.lacunarity;
        const gain = 0.5;

        let amplitude = fractalParams.amplitude;
        let frequency = fractalParams.frequency;

        let value = 0;

        for (let i = 0; i < octaves; i++) {
            value += amplitude * Noise.noise3d(
                frequency * x,
                frequency * y,
                frequency * z,
            );

            frequency *= lacunarity;
            amplitude *= gain;
        }

        return value;
    }
}

// export function noise(x: number, y: number, z?: number | FractalParams, params?: FractalParams): number {
//     if (typeof z !== 'number') {
//         params = z;
//         z = 0;
//     }

//     let result = 0.0;

//     if (params) {
//         if (!z) {
//             result = Noise.fractal2D(x, y, params);
//         } else {
//             result = Noise.fractal3D(x, y, z, params);
//         }
//     } else {
//         if (!z) {
//             result = Noise.noise2D(x, y);
//         } else {
//             result = Noise.noise3D(x, y, z);
//         }
//     }

//     return result;
// }
