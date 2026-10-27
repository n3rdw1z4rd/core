/**
 * Three.js helpers: a scene `World` (entities, component schemas, save/load), camera rig, voxel meshing, texture atlases, procedural geometry, particles.
 * Requires the `three` package (an optional peer dependency).
 *
 * ```ts
 * import { CameraRig, buildVoxelGeometry } from '@n3rdw1z4rd/core/three';
 * ```
 *
 * @packageDocumentation
 * @module @n3rdw1z4rd/core/three
 */
export * from './adaptive-grid';
export * from './asteroid-mesh';
export * from './camera-rig';
export * from './cube-sphere-geometry';
export * from './ecs';
export * from './editor-camera';
export * from './particle-system-3d';
export * from './picking';
export * from './renderer';
export * from './schema';
export * from './starfield';
export * from './texture-atlas';
export * from './texture-utils';
export * from './voxel-geometry';
export * from './voxel-mesh';
export * from './world';
