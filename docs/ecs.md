# ECS

This package intentionally ships **two unrelated ECS designs**. They were never meant to interoperate - pick whichever fits a given project.

## `ECS` (top-level, `ecs.ts`)

A component-template-registry singleton: you declare component *templates* once, then stamp out entities that reference them by name. Access it via `ECS.instance` (it's a singleton - there's no public constructor).

```ts
import { ECS } from "@n3rdw1z4rd/core";

ECS.instance
    .createComponent('position', { x: 0, y: 0 })
    .createComponent('velocity', { x: 0, y: 0 })
    .includeAsDefaultComponents('position') // every new entity gets this automatically
    .createEntity('velocity')               // also gets 'position' via the default
    .createSystem('move', 'position', 'velocity', (entity, components) => {
        components.position.x += components.velocity.x;
    });

ECS.instance.update(); // runs all registered systems once
```

Key methods on `ECS`:

```ts
uid(length?: number): string
createComponent(uid: string, data?: any): this
includeAsDefaultComponents(...components: string[]): this
createSystem(uid: string, ...components: string[], callback: ECSSystemCallback): this
createEntityWithUid(uid: string, ...components: string[]): this
createEntity(...components: string[]): this
createEntities(count: number, ...components: string[]): this
getEntity(uid: string): ECSEntity | undefined
getEntitiesWithComponents(...components: string[], filter: any): ECSEntity[]
addComponent(uid: string, component: string, values?: any): this
duplicateEntity(uid: string, count?: number, deep?: boolean): this
getGlobal(key: string): any
setGlobal(key: string, value: any): this
beforeTick(callback: () => void): this
afterTick(callback: () => void): this
runSystem(uid: string): this
update(): void
```

Component "data" can include function values, which are called with the component's own key when an entity is created - a way to get per-instance defaults (e.g. a random spawn position) instead of everyone sharing the same object reference.

## Three.js-flavored ECS (`three/ecs.ts`)

`import { ... } from "@n3rdw1z4rd/core/three";` (or the top-level barrel)

Stores components directly on a Three.js `Object3D`'s `userData`, so the scene graph itself doubles as the entity list - useful when you want `scene.traverse()` to double as entity iteration.

```ts
type ThreeComponent = Record<string, any>;

interface ThreeEntity extends Object3D {
    userData: {
        entityId: string;
        components: Record<string, ThreeComponent>;
        [key: string]: any;
    };
}

function GenerateEntityId(): string;
function CreateThreeEntity(obj?: Object3D): ThreeEntity;      // wraps an existing Object3D, or creates a new Group
function AddThreeComponent<T>(entity: ThreeEntity, name: string, component: T): void;
function GetThreeComponent<T>(entity: ThreeEntity, name: string): T | undefined;
function RemoveThreeComponent(entity: ThreeEntity, name: string): void;
function IsThreeEntity(obj: Object3D): boolean;

type ThreeSystem = (entities: Map<string, ThreeEntity>, delta: number, ...args: any) => void;
```

```ts
import { CreateThreeEntity, AddThreeComponent, GetThreeComponent } from "@n3rdw1z4rd/core";
import { Mesh, BoxGeometry, MeshBasicMaterial } from "three";

const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
const entity = CreateThreeEntity(mesh);

AddThreeComponent(entity, 'health', { hp: 100 });
scene.add(entity);

// later, e.g. inside scene.traverse():
const health = GetThreeComponent<{ hp: number }>(entity, 'health');
```

`ThreeSystem` is exported as a type only - there's no built-in system runner for this variant (unlike the top-level `ECS.update()`); you write your own loop over whatever `Map<string, ThreeEntity>` you're maintaining.
