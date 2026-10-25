import type { Intersection, Object3D, Vector3 } from 'three';
import type { ThreeEntity } from './ecs';
import type { EditorCamera } from './editor-camera';
import type { World } from './world';

/** @category Three.js */
export interface EntityHit {
    entity: ThreeEntity;
    /** world point hit */
    point: Vector3;
    distance: number;
    /** the object actually hit (e.g. a mesh a render system made under the entity) */
    object: Object3D;
}

/** @category Three.js */
export interface PickOptions {
    /**
     * On a miss, also try rays this many CSS px around the point and take the hit closest to
     * it — small things are hard to hit with a finger.
     */
    slopPx?: number;
    /** skip hits on objects this returns false for (e.g. gizmos, helpers) */
    filter?: (object: Object3D) => boolean;
}

/**
 * The entity under a screen point (CSS px): raycasts the world's scene and walks up from
 * whatever was hit to the closest entity of `world`. Invisible objects are skipped.
 *
 * @category Three.js
 */
export function pickEntity(world: World, view: EditorCamera, sx: number, sy: number, options: PickOptions = {}): EntityHit | null {
    world.root.updateMatrixWorld(); // edits since the last render haven't reached matrixWorld yet
    const direct = castAt(world, view, sx, sy, options.filter);
    if (direct || !options.slopPx) return direct;

    let best: EntityHit | null = null;
    let bestD = Infinity;
    for (const r of [options.slopPx / 2, options.slopPx]) {
        for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2;
            const hit = castAt(world, view, sx + Math.cos(a) * r, sy + Math.sin(a) * r, options.filter);
            if (hit && r < bestD) {
                best = hit;
                bestD = r;
            }
        }
        if (best) break;
    }
    return best;
}

function castAt(world: World, view: EditorCamera, sx: number, sy: number, filter?: (o: Object3D) => boolean): EntityHit | null {
    const hits: Intersection[] = view.rayAt(sx, sy).intersectObject(world.root, true);
    for (const hit of hits) {
        if (!visible(hit.object) || (filter && !filter(hit.object))) continue;
        const entity = entityOf(world, hit.object);
        if (entity) return { entity, point: hit.point, distance: hit.distance, object: hit.object };
    }
    return null;
}

/** The closest entity of `world` at or above `object`, or null. */
export function entityOf(world: World, object: Object3D): ThreeEntity | null {
    let o: Object3D | null = object;
    while (o) {
        if (world.has(o)) return o as ThreeEntity;
        o = o.parent;
    }
    return null;
}

function visible(object: Object3D): boolean {
    let o: Object3D | null = object;
    while (o) {
        if (!o.visible) return false;
        o = o.parent;
    }
    return true;
}
