import { MathUtils, Object3D, Scene } from 'three';
import { CreateThreeEntity, IsThreeEntity, type ThreeEntity } from './ecs';
import { componentToJson, components, type ComponentRegistry, type ComponentType } from './schema';

/**
 * A scene of entities: three.js objects with components (see {@link CreateThreeEntity}),
 * tracked by their `Object3D.uuid`.
 *
 * The world keeps an index of which entities have which components (for {@link World.query}),
 * runs systems, tells listeners what changed (so editor panels stay in sync), and saves and
 * loads the whole scene as plain JSON ({@link SceneDoc}).
 *
 * The three.js scene graph is the hierarchy: parent an entity under another and it moves
 * with it. Transforms live on the objects themselves (`position`, `rotation`, `scale`), so
 * there is no Transform component.
 *
 * ```ts
 * const world = new World();
 * const ball = world.create('ball');
 * world.addComponent(ball, RigidBody, { mass: 2 });
 *
 * world.addSystem({ query: ['RigidBody'], update(entities, dt) { ... } });
 * renderer.setAnimationLoop(() => { world.update(clock.tick()); renderer.render(world.root, camera); });
 *
 * const saved = world.serialize();   // JSON-safe
 * world.load(saved);                 // same entities, same uuids
 * ```
 *
 * Add and remove entities through the world (not `Object3D.add`/`remove` directly), and call
 * {@link World.changed} after editing a component in place, so the index and listeners stay
 * current.
 *
 * @category ECS
 */
export class World {
    readonly root: Object3D;
    readonly registry: ComponentRegistry;

    private readonly entities = new Map<string, ThreeEntity>();
    private readonly index = new Map<string, Set<ThreeEntity>>();
    private readonly systems: WorldSystem[] = [];
    private readonly listeners = new Map<keyof WorldEvents, Set<(...args: any[]) => void>>();

    constructor(options: { root?: Object3D; registry?: ComponentRegistry } = {}) {
        this.root = options.root ?? new Scene();
        this.registry = options.registry ?? components;
    }

    /* ── entities ──────────────────────────────────────────────── */

    /** number of entities */
    get size(): number {
        return this.entities.size;
    }

    [Symbol.iterator](): IterableIterator<ThreeEntity> {
        return this.entities.values();
    }

    /** The entity with this uuid. */
    get(uuid: string): ThreeEntity | undefined {
        return this.entities.get(uuid);
    }

    has(obj: Object3D): boolean {
        return this.entities.get(obj.uuid) === obj;
    }

    /** Makes a new entity (an empty `Group`, or `obj`) and adds it under `parent` (default: the root). */
    create(name = '', parent: Object3D = this.root, obj?: Object3D): ThreeEntity {
        const entity = CreateThreeEntity(obj);
        if (name) entity.name = name;
        return this.add(entity, parent);
    }

    /**
     * Puts `obj` under `parent` (default: the root) and starts tracking it — and every entity
     * among its descendants. `obj` is made an entity if it isn't one.
     */
    add(obj: Object3D, parent: Object3D = this.root): ThreeEntity {
        if (!IsThreeEntity(obj)) CreateThreeEntity(obj);
        parent.add(obj);
        obj.traverse((o) => {
            if (IsThreeEntity(o)) this.track(o as ThreeEntity);
        });
        return obj as ThreeEntity;
    }

    /** Takes the entity (and its descendants) out of the scene and stops tracking them. */
    remove(entity: Object3D): void {
        const gone: ThreeEntity[] = [];
        entity.traverse((o) => {
            if (this.entities.get(o.uuid) === o) gone.push(o as ThreeEntity);
        });
        entity.removeFromParent();
        for (const e of gone.reverse()) this.untrack(e);
    }

    /** Removes every entity. */
    clear(): void {
        for (const child of [...this.root.children]) {
            let hasEntity = false;
            child.traverse((o) => (hasEntity ||= IsThreeEntity(o)));
            if (hasEntity) this.remove(child);
        }
    }

    /**
     * Moves `entity` under `parent` (default: the root). By default its world transform is
     * kept (it doesn't jump); pass `keepWorldTransform = false` to keep its local one instead.
     */
    reparent(entity: ThreeEntity, parent: Object3D = this.root, keepWorldTransform = true): void {
        let p: Object3D | null = parent;
        while (p) {
            if (p === entity) throw new Error('World.reparent: cannot parent an entity under itself');
            p = p.parent;
        }
        if (keepWorldTransform) parent.attach(entity);
        else parent.add(entity);
        this.emit('reparented', entity, parent);
    }

    /** The closest ancestor that is an entity of this world, or null. */
    parentOf(entity: Object3D): ThreeEntity | null {
        let p = entity.parent;
        while (p && p !== this.root) {
            if (this.entities.get(p.uuid) === p) return p as ThreeEntity;
            p = p.parent;
        }
        return null;
    }

    /** The entities directly under `parent` (default: the root), looking through non-entity objects. */
    childrenOf(parent: Object3D = this.root): ThreeEntity[] {
        const out: ThreeEntity[] = [];
        const visit = (o: Object3D) => {
            for (const c of o.children) {
                if (this.entities.get(c.uuid) === c) out.push(c as ThreeEntity);
                else visit(c);
            }
        };
        visit(parent);
        return out;
    }

    /** A deep copy of the entity and its descendant entities (new uuids), added next to it. */
    clone(entity: ThreeEntity, parent: Object3D = entity.parent ?? this.root): ThreeEntity {
        const docs = this.serializeEntities([entity]);
        const [copy] = this.instantiate(docs, { parent, newIds: true });
        return copy;
    }

    private track(entity: ThreeEntity): void {
        // Object3D.clone() copies userData but makes a new uuid
        entity.userData.entityId = entity.uuid;
        const existing = this.entities.get(entity.uuid);
        if (existing === entity) return;
        if (existing) throw new Error(`World: another entity already has uuid ${entity.uuid}`);

        this.entities.set(entity.uuid, entity);
        for (const name of Object.keys(entity.userData.components)) this.indexSet(name).add(entity);
        this.emit('entityAdded', entity);
    }

    private untrack(entity: ThreeEntity): void {
        if (!this.entities.delete(entity.uuid)) return;
        for (const name of Object.keys(entity.userData.components)) this.index.get(name)?.delete(entity);
        this.emit('entityRemoved', entity);
    }

    private indexSet(name: string): Set<ThreeEntity> {
        let set = this.index.get(name);
        if (!set) this.index.set(name, (set = new Set()));
        return set;
    }

    /* ── components ────────────────────────────────────────────── */

    /** The registered type for a name, class or type; throws if unknown. */
    typeOf(ref: ComponentRef): ComponentType {
        const type = this.registry.resolve(ref as any);
        if (!type) throw new Error(`World: unknown component type ${typeof ref === 'string' ? `"${ref}"` : String((ref as any)?.name ?? ref)}`);
        return type;
    }

    /**
     * Adds a component made from its type's defaults plus `data`, replacing one of the same
     * type. Returns the component.
     */
    addComponent<T extends object>(entity: ThreeEntity, ref: ComponentRef<T>, data?: Record<string, unknown>): T {
        const type = this.typeOf(ref) as ComponentType<T>;
        const name = type.schema.name;
        const previous = entity.userData.components[name];
        if (previous) this.emit('componentRemoved', entity, name, previous);

        const component = type.create(data);
        entity.userData.components[name] = component;
        if (this.has(entity)) this.indexSet(name).add(entity);
        this.emit('componentAdded', entity, name, component);
        return component;
    }

    getComponent<T extends object>(entity: ThreeEntity, ref: ComponentRef<T>): T | undefined {
        return entity.userData.components[this.nameOf(ref)] as T | undefined;
    }

    hasComponent(entity: ThreeEntity, ref: ComponentRef): boolean {
        return this.nameOf(ref) in entity.userData.components;
    }

    removeComponent(entity: ThreeEntity, ref: ComponentRef): void {
        const name = this.nameOf(ref);
        const component = entity.userData.components[name];
        if (component === undefined) return;
        delete entity.userData.components[name];
        this.index.get(name)?.delete(entity);
        this.emit('componentRemoved', entity, name, component);
    }

    /** The names of the entity's components, in the order they were added. */
    componentNames(entity: ThreeEntity): string[] {
        return Object.keys(entity.userData.components);
    }

    /**
     * Tells listeners a component (or the entity's transform/name, with `component` omitted)
     * was edited in place. `field` narrows it to one field.
     */
    changed(entity: ThreeEntity, component?: ComponentRef, field?: string): void {
        this.emit('changed', entity, component === undefined ? undefined : this.nameOf(component), field);
    }

    /** Entities that have every one of the given components. */
    query(...refs: ComponentRef[]): ThreeEntity[] {
        if (refs.length === 0) return [...this.entities.values()];
        const names = refs.map((r) => this.nameOf(r));
        const sets = names.map((n) => this.index.get(n) ?? new Set<ThreeEntity>());
        sets.sort((a, b) => a.size - b.size);
        const [smallest, ...rest] = sets;
        const out: ThreeEntity[] = [];
        for (const e of smallest) if (rest.every((s) => s.has(e))) out.push(e);
        return out;
    }

    /** Entities whose name is `name`. */
    findByName(name: string): ThreeEntity[] {
        return [...this.entities.values()].filter((e) => e.name === name);
    }

    private nameOf(ref: ComponentRef): string {
        if (typeof ref === 'string') return ref;
        return this.typeOf(ref).schema.name;
    }

    /* ── systems ───────────────────────────────────────────────── */

    /**
     * Adds a system, run by {@link World.update} in the order added. With a `query`, it gets
     * the entities that have all of those components; without, every entity.
     */
    addSystem(system: WorldSystem | WorldSystem['update'], query?: ComponentRef[]): WorldSystem {
        const s: WorldSystem = typeof system === 'function' ? { update: system, query } : system;
        this.systems.push(s);
        return s;
    }

    removeSystem(system: WorldSystem): void {
        const i = this.systems.indexOf(system);
        if (i >= 0) this.systems.splice(i, 1);
    }

    /** Runs every enabled system once. */
    update(delta: number): void {
        for (const s of [...this.systems]) {
            if (s.enabled === false) continue;
            s.update(this.query(...(s.query ?? [])), delta, this);
        }
    }

    /* ── events ────────────────────────────────────────────────── */

    /** Listens for an event; returns a function that stops listening. */
    on<K extends keyof WorldEvents>(event: K, listener: (...args: WorldEvents[K]) => void): () => void {
        let set = this.listeners.get(event);
        if (!set) this.listeners.set(event, (set = new Set()));
        set.add(listener);
        return () => set!.delete(listener);
    }

    private emit<K extends keyof WorldEvents>(event: K, ...args: WorldEvents[K]): void {
        const set = this.listeners.get(event);
        if (set) for (const l of [...set]) l(...args);
    }

    /* ── save / load ───────────────────────────────────────────── */

    /** The whole scene as plain JSON. */
    serialize(meta?: Record<string, unknown>): SceneDoc {
        return { format: SCENE_FORMAT, version: SCENE_VERSION, entities: this.serializeEntities(this.childrenOf()), ...(meta ? { meta } : {}) };
    }

    /**
     * Replaces the scene with a saved one (or, with `replace: false`, adds to it). Entities
     * keep their saved uuids.
     */
    load(doc: SceneDoc, options: { replace?: boolean } = {}): ThreeEntity[] {
        if (doc?.format !== SCENE_FORMAT) throw new Error('World.load: not a scene document');
        if (doc.version > SCENE_VERSION) throw new Error(`World.load: scene version ${doc.version} is newer than supported (${SCENE_VERSION})`);
        if (options.replace !== false) this.clear();
        return this.instantiate(doc.entities);
    }

    /**
     * `entities` and their descendant entities, depth-first (parents before children), as JSON:
     * e.g. a prefab or the clipboard.
     */
    serializeEntities(entities: ThreeEntity[]): EntityDoc[] {
        const out: EntityDoc[] = [];
        const visit = (e: ThreeEntity, parent: string | null) => {
            out.push(this.serializeEntity(e, parent));
            for (const c of this.childrenOf(e)) visit(c, e.uuid);
        };
        for (const e of entities) visit(e, null);
        return out;
    }

    private serializeEntity(e: ThreeEntity, parent: string | null): EntityDoc {
        const doc: EntityDoc = {
            uuid: e.uuid,
            parent,
            position: e.position.toArray() as Vec3,
            rotation: [e.rotation.x, e.rotation.y, e.rotation.z],
            scale: e.scale.toArray() as Vec3,
            components: {},
        };
        if (e.name) doc.name = e.name;
        if (e.rotation.order !== 'XYZ') doc.rotationOrder = e.rotation.order;
        if (!e.visible) doc.visible = false;

        for (const [name, component] of Object.entries(e.userData.components)) {
            const type = this.registry.get(name);
            // an unknown type (e.g. from a plugin that isn't loaded) is kept as it was saved
            doc.components[name] = type ? componentToJson(type, component) : structuredClone(component);
        }
        return doc;
    }

    /**
     * Makes entities from saved docs. A doc whose `parent` isn't among `docs` goes under
     * `options.parent` (default: the root). With `newIds`, every entity gets a fresh uuid and
     * `entity` fields pointing inside the set are remapped (pasting, prefabs, clone).
     */
    instantiate(docs: EntityDoc[], options: { parent?: Object3D; newIds?: boolean } = {}): ThreeEntity[] {
        const parent = options.parent ?? this.root;
        const ids = new Map<string, string>();
        for (const d of docs) ids.set(d.uuid, options.newIds ? MathUtils.generateUUID() : d.uuid);

        const made = new Map<string, ThreeEntity>();
        const roots: ThreeEntity[] = [];

        for (const d of docs) {
            const entity = CreateThreeEntity();
            entity.uuid = ids.get(d.uuid)!;
            entity.name = d.name ?? '';
            entity.position.fromArray(d.position ?? [0, 0, 0]);
            entity.rotation.set(...(d.rotation ?? [0, 0, 0]), (d.rotationOrder as any) ?? 'XYZ');
            entity.scale.fromArray(d.scale ?? [1, 1, 1]);
            entity.visible = d.visible !== false;

            for (const [name, data] of Object.entries(d.components ?? {})) {
                const type = this.registry.get(name);
                if (!type) {
                    entity.userData.components[name] = structuredClone(data);
                    continue;
                }
                const component = type.create(data) as Record<string, any>;
                if (options.newIds) {
                    for (const [key, def] of Object.entries(type.schema.fields)) {
                        if (def.type === 'entity' && ids.has(component[key])) component[key] = ids.get(component[key]);
                    }
                }
                entity.userData.components[name] = component;
            }

            made.set(d.uuid, entity);
            const p = d.parent !== null && d.parent !== undefined ? made.get(d.parent) : undefined;
            if (p) p.add(entity);
            else roots.push(entity);
        }

        for (const r of roots) this.add(r, parent);
        return roots;
    }
}

/** A component reference: its name, type, or class. */
export type ComponentRef<T extends object = any> = string | ComponentType<T> | (new () => T);

/** @category ECS */
export interface WorldSystem {
    /** components an entity needs to be passed to `update` */
    query?: ComponentRef[];
    /** false skips it in {@link World.update} */
    enabled?: boolean;
    update(entities: ThreeEntity[], delta: number, world: World): void;
}

/** @category ECS */
export interface WorldEvents {
    entityAdded: [entity: ThreeEntity];
    entityRemoved: [entity: ThreeEntity];
    componentAdded: [entity: ThreeEntity, name: string, component: object];
    componentRemoved: [entity: ThreeEntity, name: string, component: object];
    /** `component` undefined: the entity itself (transform, name, visibility) */
    changed: [entity: ThreeEntity, component: string | undefined, field: string | undefined];
    reparented: [entity: ThreeEntity, parent: Object3D];
}

type Vec3 = [number, number, number];

export const SCENE_FORMAT = 'n3rdw1z4rd.scene';
export const SCENE_VERSION = 1;

/**
 * A saved scene: plain JSON.
 *
 * @category ECS
 */
export interface SceneDoc {
    format: typeof SCENE_FORMAT;
    version: number;
    /** depth-first: parents before their children */
    entities: EntityDoc[];
    /** anything else the app wants saved with the scene (camera, settings, scripts…) */
    meta?: Record<string, unknown>;
}

/**
 * One saved entity. Only entities are saved: non-entity objects (e.g. meshes a render
 * system made) are rebuilt from components.
 *
 * @category ECS
 */
export interface EntityDoc {
    uuid: string;
    name?: string;
    /** the parent entity's uuid; null for a top-level entity */
    parent: string | null;
    position: Vec3;
    /** Euler angles, radians */
    rotation: Vec3;
    rotationOrder?: string;
    scale: Vec3;
    visible?: false;
    /** component JSON by type name */
    components: Record<string, Record<string, unknown>>;
}
