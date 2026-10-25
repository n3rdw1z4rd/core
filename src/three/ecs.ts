import { Group, Object3D } from 'three';

/**
 * A component: any plain object of data, stored by name on a {@link ThreeEntity}.
 *
 * @category ECS
 */
export type ThreeComponent = Record<string, any>;

/**
 * An `Object3D` used as an entity: its id and components live in `userData`. Create one with
 * {@link CreateThreeEntity}.
 *
 * @category ECS
 */
export interface ThreeEntity extends Object3D {
    /** `Object3D.userData` with the entity's id and components */
    userData: {
        /** the object's `uuid` (kept in sync by {@link World}) */
        entityId: string;
        /** components by name */
        components: Record<string, ThreeComponent>;
        [key: string]: any; // allow other Three.js stuff too
    };
}

let entityCounter = 0;

/**
 * Returns a new id `"entity_<n>"` from a module-level counter (unique per page load, not random).
 *
 * @deprecated entities now use their `Object3D.uuid` as id (stable across save and load);
 * this is no longer used by {@link CreateThreeEntity}
 * @category ECS
 */
export function GenerateEntityId(): string {
    return `entity_${entityCounter++}`;
}

/**
 * Turns `obj` (default: a new `Group`) into an entity in place: an empty component set
 * (replacing any it had), with its `uuid` as id.
 *
 * ```ts
 * const ship = CreateThreeEntity(shipMesh);
 * AddThreeComponent(ship, 'velocity', { x: 0, y: 0, z: 1 });
 * GetThreeComponent<{ x: number, y: number, z: number }>(ship, 'velocity')!.z; // 1
 * ```
 *
 * @returns the same object, typed as a {@link ThreeEntity}
 * @category ECS
 */
export function CreateThreeEntity(obj?: Object3D): ThreeEntity {
    const entity = (obj ?? new Group()) as ThreeEntity;
    entity.userData.entityId = entity.uuid;
    entity.userData.components = {};
    return entity;
}

/**
 * Stores `component` on `entity` under `name`, replacing any component with that name.
 *
 * @category ECS
 */
export function AddThreeComponent<T extends ThreeComponent>(
    entity: ThreeEntity,
    name: string,
    component: T,
) {
    entity.userData.components[name] = component;
}

/**
 * The component named `name`, or `undefined` if the entity has none. `T` is not checked.
 *
 * @category ECS
 */
export function GetThreeComponent<T extends ThreeComponent>(
    entity: ThreeEntity,
    name: string,
): T | undefined {
    return entity.userData.components[name] as T | undefined;
}

/**
 * Removes the component named `name`, if any.
 *
 * @category ECS
 */
export function RemoveThreeComponent(entity: ThreeEntity, name: string) {
    delete entity.userData.components[name];
}

/**
 * Whether `obj` has been made an entity (has a `userData.entityId`).
 *
 * @category ECS
 */
export function IsThreeEntity(obj: Object3D): boolean {
    return obj.userData.entityId !== undefined;
}

/**
 * A system: called with all entities (by id) and the frame's delta time, plus any extra arguments.
 *
 * @category ECS
 */
export type ThreeSystem = (entities: Map<string, ThreeEntity>, delta: number, ...args: any) => void;
