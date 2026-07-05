import { Group, Object3D } from 'three';

/**
 * Alternate ECS design to core's top-level {@link ECS} (component-template
 * registry singleton, `ECS.instance`). This version stores entities as
 * Three.js `Object3D`/`Group` instances directly - components live in
 * `userData` - which is convenient when the scene graph itself should
 * double as the entity list. Kept as a separate, opt-in module rather than
 * replacing the top-level `ECS`.
 * @module
 */

/** A component's data - any plain object attached under a string name in {@link ThreeEntity.userData.components}. */
export type ThreeComponent = Record<string, any>;

/** An `Object3D`/`Group` tagged with an entity id and a component-name -> data map in `userData`. */
export interface ThreeEntity extends Object3D {
    userData: {
        entityId: string;
        components: Record<string, ThreeComponent>;
        [key: string]: any; // allow other Three.js stuff too
    };
}

let entityCounter = 0;
/** Generates a unique, incrementing entity id string (`entity_0`, `entity_1`, ...). */
export function GenerateEntityId(): string {
    return `entity_${entityCounter++}`;
}

/** Tags `obj` (or a new `Group` if omitted) as a {@link ThreeEntity}, giving it a fresh id and empty component map. */
export function CreateThreeEntity(obj?: Object3D): ThreeEntity {
    const entity = (obj ?? new Group()) as ThreeEntity;
    entity.userData.entityId = GenerateEntityId();
    entity.userData.components = {};
    return entity;
}

/** Attaches component data under `name` on an existing {@link ThreeEntity}. */
export function AddThreeComponent<T extends ThreeComponent>(
    entity: ThreeEntity,
    name: string,
    component: T,
) {
    entity.userData.components[name] = component;
}

/** Reads component data by name, or `undefined` if the entity doesn't have it. */
export function GetThreeComponent<T extends ThreeComponent>(
    entity: ThreeEntity,
    name: string,
): T | undefined {
    return entity.userData.components[name] as T | undefined;
}

/** Removes a component by name from an entity. */
export function RemoveThreeComponent(entity: ThreeEntity, name: string) {
    delete entity.userData.components[name];
}

/** Whether `obj` has been tagged as a {@link ThreeEntity} (i.e. created via {@link CreateThreeEntity}). */
export function IsThreeEntity(obj: Object3D): boolean {
    return obj.userData.entityId !== undefined;
}

/** A per-tick system callback operating over a map of entities, matching the scene-graph-as-ECS pattern in this module. */
export type ThreeSystem = (entities: Map<string, ThreeEntity>, delta: number, ...args: any) => void;
