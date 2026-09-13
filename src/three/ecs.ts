import { Group, Object3D } from 'three';

export type ThreeComponent = Record<string, any>;

export interface ThreeEntity extends Object3D {
    userData: {
        entityId: string;
        components: Record<string, ThreeComponent>;
        [key: string]: any; // allow other Three.js stuff too
    };
}

let entityCounter = 0;

export function GenerateEntityId(): string {
    return `entity_${entityCounter++}`;
}

export function CreateThreeEntity(obj?: Object3D): ThreeEntity {
    const entity = (obj ?? new Group()) as ThreeEntity;
    entity.userData.entityId = GenerateEntityId();
    entity.userData.components = {};
    return entity;
}

export function AddThreeComponent<T extends ThreeComponent>(
    entity: ThreeEntity,
    name: string,
    component: T,
) {
    entity.userData.components[name] = component;
}

export function GetThreeComponent<T extends ThreeComponent>(
    entity: ThreeEntity,
    name: string,
): T | undefined {
    return entity.userData.components[name] as T | undefined;
}

export function RemoveThreeComponent(entity: ThreeEntity, name: string) {
    delete entity.userData.components[name];
}

export function IsThreeEntity(obj: Object3D): boolean {
    return obj.userData.entityId !== undefined;
}

export type ThreeSystem = (entities: Map<string, ThreeEntity>, delta: number, ...args: any) => void;
