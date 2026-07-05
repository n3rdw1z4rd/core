import { createNoise2D, createNoise3D, createNoise4D, NoiseFunction2D, NoiseFunction3D, NoiseFunction4D } from 'simplex-noise';
import { rng } from './rng';

/** Layering options for {@link Noise.fractal2d} / {@link Noise.fractal3d} (fractal Brownian motion). */
export interface FractalParams {
    /** Number of noise layers summed together. */
    octaves: number;
    /** Base sampling frequency of the first octave. */
    frequency: number;
    /** Unused by the current implementation (gain is fixed at 0.5) - reserved for a future per-octave amplitude falloff control. */
    persistence: number;
    /** Amplitude of the first octave; each subsequent octave is scaled by `0.5`. */
    amplitude: number;
    /** Frequency multiplier applied each octave (>1 adds finer detail per layer). */
    lacunarity: number;
}

/**
 * Static wrapper around `simplex-noise`, seeded from core's shared
 * {@link rng} so noise output is reproducible alongside everything else
 * that draws from it. Each dimensionality's underlying noise function is
 * lazily created once and reused.
 */
export class Noise {
    private static _n2d: NoiseFunction2D;
    private static _n3d: NoiseFunction3D;
    private static _n4d: NoiseFunction4D;

    /** 2D simplex noise, roughly in `[-1, 1]`. */
    public static noise2d(x: number, y: number): number {
        if (!Noise._n2d) {
            Noise._n2d = createNoise2D(() => rng.nextf);
        }

        return Noise._n2d(x, y);
    }

    /** 3D simplex noise, roughly in `[-1, 1]`. */
    public static noise3d(x: number, y: number, z: number): number {
        if (!Noise._n3d) {
            Noise._n3d = createNoise3D(() => rng.nextf);
        }

        return Noise._n3d(x, y, z);
    }

    /** 4D simplex noise, roughly in `[-1, 1]`. */
    public static noise4d(x: number, y: number, z: number, w: number): number {
        if (!Noise._n4d) {
            Noise._n4d = createNoise4D(() => rng.nextf);
        }

        return Noise._n4d(x, y, z, w);
    }

    /** Sums multiple octaves of {@link noise2d} at increasing frequency/decreasing amplitude for more natural-looking terrain/texture. */
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

    /** Sums multiple octaves of {@link noise3d}. See {@link fractal2d}. */
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
