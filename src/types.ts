/**
 * Any object with numeric `x` and `y`, such as a {@link Vector}.
 * @property x horizontal coordinate
 * @property y vertical coordinate
 * @category Math & Random
 */
export interface XY { x: number, y: number }
/**
 * Any object with numeric `x`, `y` and `z`.
 * @property x x coordinate
 * @property y y coordinate
 * @property z z coordinate
 * @category Math & Random
 */
export interface XYZ { x: number, y: number, z: number }

/**
 * Plain object with string keys and values of any type.
 * @category Math & Random
 */
export type KeyValue = Record<string, any>;

/**
 * matches simplex-noise's NoiseFunction3D, e.g. createNoise3D(() => rng.nextFloat())
 * @category Math & Random
 */
export type NoiseFunction3D = (x: number, y: number, z: number) => number;
