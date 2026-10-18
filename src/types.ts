export interface XY { x: number, y: number }
export interface XYZ { x: number, y: number, z: number }

export type KeyValue = Record<string, any>;

/** matches simplex-noise's NoiseFunction3D, e.g. createNoise3D(() => rng.nextFloat()) */
export type NoiseFunction3D = (x: number, y: number, z: number) => number;
