import { log, logwrn } from './logger';

/** Callback invoked once per matching entity when a system runs. */
export type ECSSystemCallback = (entity: ECSEntity, components: any) => void;
/** Callback invoked once per {@link ECS.update} tick, with no arguments. */
export type ECSTickCallback = () => void;

/** A registered system: the component names it requires, plus the callback to run for each matching entity. */
export interface ECSSystem {
    components: string[],
    callback: ECSSystemCallback,
};

/** A single entity: its unique id and its component-name -> data map. */
export interface ECSEntity {
    uid: string,
    components: Map<string, any>,
};

/**
 * Minimal entity-component-system container. Components are registered as
 * named data templates, entities are built by attaching component names
 * (copying/evaluating the template data), and systems are callbacks that
 * run against every entity holding a given set of components. Accessed as
 * a singleton via {@link ECS.instance}.
 */
export class ECS {
    private _globals: Map<string, any> = new Map<string, any>();
    private _entities: Map<string, ECSEntity> = new Map<string, ECSEntity>();
    private _components: Map<string, any> = new Map<string, any>();
    private _defaultComponents: string[] = [];
    private _systems: Map<string, ECSSystem> = new Map<string, ECSSystem>();
    private _onTickStartCallbacks: ECSTickCallback[] = [];
    private _onTickEndCallbacks: ECSTickCallback[] = [];

    /** Names of all registered components. */
    public get components(): string[] {
        return [...this._components.keys()];
    }

    /** Names of all registered systems. */
    public get systems(): string[] {
        return [...this._systems.keys()];
    }

    /** All currently-existing entities. */
    public get entities(): ECSEntity[] {
        return [...this._entities.values()];
    }

    /** Generates a random hex id of the given `length` using `crypto.getRandomValues`. */
    public uid(length: number = 8): string {
        const numBytes: number = Math.ceil(length / 2);
        const buffer = new Uint8Array(numBytes);

        window.crypto.getRandomValues(buffer);

        let uid: string = '';

        for (let i = 0; i < buffer.length; i++) {
            uid += buffer[i].toString(16).padStart(2, '0');
        }

        return uid.substring(0, length);
    }

    /**
     * Registers a component template under `uid`. `data` is the shape
     * attached to entities that include this component - values that are
     * functions are invoked with the entity's uid at creation time,
     * everything else is copied as-is.
     */
    public createComponent(uid: string, data: any = null): this {
        if (!this._components.has(uid)) {
            this._components.set(uid, data);
            log('created component:', { uid, data });
        } else {
            logwrn('createComponent: a component already exists with uid:', uid);
        }

        return this;
    }

    /** Marks component names to be attached automatically to every entity created afterward. */
    public includeAsDefaultComponents(...components: string[]): this {
        components.forEach((component: string) => {
            if (!this._defaultComponents.includes(component)) {
                this._defaultComponents.push(component);
                log('includeAsDefaultComponents:', component);
            } else {
                log('includeAsDefaultComponents: already exists:', component);
            }
        });

        return this;
    }

    /**
     * Registers a system under `uid`: a list of required component names
     * followed by the callback to invoke for each entity that has all of
     * them (see {@link runSystem} / {@link update}).
     */
    public createSystem<T extends string[]>(uid: string, ...components: [...T, ECSSystemCallback]): this {
        const callback: ECSSystemCallback = components.pop() as ECSSystemCallback;

        const comps: string[] = components.filter((comp: any) => (typeof comp === 'string')) as string[];

        if (!this._systems.has(uid)) {
            this._systems.set(uid, { components: comps, callback });
            log('created system:', { uid, components, callback });
        } else {
            logwrn('createSystem: a system already exists with uid:', uid);
        }

        return this;
    }

    /**
     * Creates an entity with an explicit `uid`, attaching the default
     * components plus the given `components`. Fails (logs a warning, does
     * not create the entity) if any named component isn't registered.
     */
    public createEntityWithUid(uid: string, ...components: string[]): this {
        if (!this._entities.has(uid)) {
            const componentList: string[] = [
                ...(new Set<string>([
                    ...this._defaultComponents,
                    ...components,
                ]))];

            const comps: Map<string, any> = new Map<string, any>();

            componentList.forEach((component: string) => {
                if (this._components.has(component)) {
                    const componentData: any = this._components.get(component);
                    const data: any = {};

                    for (const uid in componentData) {
                        const value = componentData[uid];

                        data[uid] = (typeof value === 'function') ? value(uid) : value;
                    }

                    comps.set(component, data);
                } else {
                    logwrn('createEntityWithUid: missing component:', component);
                }
            });

            if (comps.size === componentList.length) {
                const entity: ECSEntity = { uid, components: comps };
                this._entities.set(uid, entity);
                log('created entity:', entity);
            } else {
                logwrn('createEntityWithUid: failed to create an entity with missing components');
            }
        } else {
            logwrn('createEntityWithUid: an entity already exists with uid:', uid);
        }

        return this;
    }

    /** Creates an entity with an auto-generated uid. See {@link createEntityWithUid}. */
    public createEntity(...components: string[]): this {
        const uid: string = this.uid();

        return this.createEntityWithUid(uid, ...components);
    }

    /** Creates `count` entities, each with the same set of `components`. */
    public createEntities(count: number, ...components: string[]): this {
        for (; count > 0; count--) {
            this.createEntity(...components);
        }

        return this;
    }

    /** Looks up an entity by uid, or `undefined` if it doesn't exist. */
    public getEntity(uid: string): ECSEntity | undefined {
        return this._entities.get(uid);
    }

    /**
     * Finds entities that have every named component, further filtered by
     * a final `filter` object of the shape
     * `{ [componentName]: { [field]: expectedValue } }` - an entity only
     * matches if every listed field equals the expected value.
     */
    public getEntitiesWithComponents<T extends string[]>(...components: [...T, filter: any]): ECSEntity[] {
        const filter: any = components.pop() as any;
        const uids: string[] = components.filter((component: any) => typeof component === 'string');

        const entities: ECSEntity[] = []

        this._entities.forEach((entity: ECSEntity) => {
            if (uids.every((component: string) =>
                [...entity.components.keys()].includes(component)
            )) {
                for (const filterComponent in filter) {
                    for (const filterKey in filter[filterComponent]) {
                        const entityValue = entity.components.get(filterComponent)[filterKey];
                        const filterValue = filter[filterComponent][filterKey];

                        if (entityValue === filterValue) {
                            entities.push(entity);
                        }
                    }
                }
            }
        });

        return entities;
    }

    /** Attaches a registered `component` to an existing entity, merging `values` over the component's template data. */
    public addComponent(uid: string, component: string, values: any = {}): this {
        const entity: ECSEntity | undefined = this._entities.get(uid);

        if (entity) {
            if (this._components.has(component)) {
                const comp: any = this._components.get(component);

                const componentData: any = {
                    ...comp,
                    ...values,
                };

                entity.components.set(component, componentData);

                log('addComponent: added component:', component, 'to entity:', uid);
            } else {
                logwrn('addComponent: component not found:', component);
            }
        } else {
            logwrn('addComponent: entity not found:', uid);
        }

        return this;
    }

    /** Immediately invokes `callback` once per existing entity (a one-off pass, not a registered system). */
    public onAllEntitiesNow(callback: (entit: ECSEntity) => void): this {
        this._entities.forEach((entity: ECSEntity) => callback(entity));
        log('onAllEntitiesNow: executed on all entities:', callback);

        return this;
    }

    /**
     * Creates `count` copies of an existing entity. When `deep` is `false`
     * (default), each copy is rebuilt from scratch via {@link createEntity}
     * (fresh component data from templates); when `true`, the copies share
     * references to the original entity's component data objects.
     */
    public duplicateEntity(uid: string, count: number = 1, deep: boolean = false): this {
        const entity: ECSEntity | undefined = this._entities.get(uid);

        if (entity) {
            if (!deep) {
                for (let i = 0; i < count; i++) this.createEntity(...entity.components.keys());
            } else {
                for (let i = 0; i < count; i++) {
                    const newEntity: ECSEntity = { uid: this.uid(), components: new Map<string, any>() };

                    entity.components.forEach((value: any, key: string) => {
                        newEntity.components.set(key, value);
                    });

                    this._entities.set(newEntity.uid, newEntity);
                };
            }

            log('duplicateEntity: duplicated entity:', uid);
        } else {
            logwrn('duplicateEntity: entity not found:', uid);
        }

        return this;
    }

    /** Reads a value from the ECS-wide key/value store (for state not tied to any entity). */
    public getGlobal(key: string): any {
        return this._globals.get(key);
    }

    /** Writes a value to the ECS-wide key/value store. See {@link getGlobal}. */
    public setGlobal(key: string, value: any): this {
        this._globals.set(key, value);

        return this;
    }

    /** Registers a callback to run at the start of every {@link update} tick, before any systems. */
    public beforeTick(callback: ECSTickCallback): this {
        this._onTickStartCallbacks.push(callback);
        log('beforeTick: added:', callback);

        return this;
    }

    /** Registers a callback to run at the end of every {@link update} tick, after all systems. */
    public afterTick(callback: ECSTickCallback): this {
        this._onTickEndCallbacks.push(callback);
        log('afterTick: added:', callback);

        return this;
    }

    /** Runs a single registered system against every entity that has all of its required components. */
    public runSystem(uid: string): this {
        const system: ECSSystem | undefined = this._systems.get(uid);

        if (system) {
            this._entities.forEach((entity: ECSEntity) => {
                if (system.components.every((component: string) =>
                    [...entity.components.keys()].includes(component)
                )) {
                    system.callback(entity, Object.fromEntries(entity.components));
                }
            });
        } else {
            logwrn('runSystem: system not found:', uid);
        }

        return this;
    }

    /** Runs one full tick: `beforeTick` callbacks, then every registered system, then `afterTick` callbacks. */
    public update(): void {
        this._onTickStartCallbacks.forEach((cb: ECSTickCallback) => cb());
        this._systems.forEach((_: ECSSystem, uid: string) => this.runSystem(uid));
        this._onTickEndCallbacks.forEach((cb: ECSTickCallback) => cb());
    }

    /** The shared `ECS` singleton (the constructor is private - use this instead of `new ECS()`). */
    public static get instance(): ECS {
        if (!ECS._instance) {
            ECS._instance = new ECS();
        }

        return ECS._instance;
    }

    private static _instance: ECS;

    private constructor() { }
}
