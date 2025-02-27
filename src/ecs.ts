import { log, logwrn } from './logger';

export type ECSSystemCallback = (entity: ECSEntity, components: any) => void;
export type ECSTickCallback = () => void;

export interface ECSSystem {
    components: string[],
    callback: ECSSystemCallback,
};

export interface ECSEntity {
    uid: string,
    components: Map<string, any>,
};

export class ECS {
    private _globals: Map<string, any> = new Map<string, any>();
    private _entities: Map<string, ECSEntity> = new Map<string, ECSEntity>();
    private _components: Map<string, any> = new Map<string, any>();
    private _defaultComponents: string[] = [];
    private _systems: Map<string, ECSSystem> = new Map<string, ECSSystem>();
    private _onTickStartCallbacks: ECSTickCallback[] = [];
    private _onTickEndCallbacks: ECSTickCallback[] = [];

    public get components(): string[] {
        return [...this._components.keys()];
    }

    public get systems(): string[] {
        return [...this._systems.keys()];
    }

    public get entities(): ECSEntity[] {
        return [...this._entities.values()];
    }

    public uid(length: number = 8): string {
        const numBytes: number = Math.ceil(length / 2);
        const buffer: Uint8Array = new Uint8Array(numBytes);

        window.crypto.getRandomValues(buffer);

        let uid: string = '';

        for (let i = 0; i < buffer.length; i++) {
            uid += buffer[i].toString(16).padStart(2, '0');
        }

        return uid.substring(0, length);
    }

    public createComponent(uid: string, data: any = null): this {
        if (!this._components.has(uid)) {
            this._components.set(uid, data);
            log('created component:', { uid, data });
        } else {
            logwrn('createComponent: a component already exists with uid:', uid);
        }

        return this;
    }

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

    public createEntity(...components: string[]): this {
        const uid: string = this.uid();

        return this.createEntityWithUid(uid, ...components);
    }

    public createEntities(count: number, ...components: string[]): this {
        for (; count > 0; count--) {
            this.createEntity(...components);
        }

        return this;
    }

    public getEntity(uid: string): ECSEntity | undefined {
        return this._entities.get(uid);
    }

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

    public onAllEntitiesNow(callback: (entit: ECSEntity) => void): this {
        this._entities.forEach((entity: ECSEntity) => callback(entity));
        log('onAllEntitiesNow: executed on all entities:', callback);

        return this;
    }

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

    public getGlobal(key: string): any {
        return this._globals.get(key);
    }

    public setGlobal(key: string, value: any): this {
        this._globals.set(key, value);

        return this;
    }

    public beforeTick(callback: ECSTickCallback): this {
        this._onTickStartCallbacks.push(callback);
        log('beforeTick: added:', callback);

        return this;
    }

    public afterTick(callback: ECSTickCallback): this {
        this._onTickEndCallbacks.push(callback);
        log('afterTick: added:', callback);

        return this;
    }

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

    public update(): void {
        this._onTickStartCallbacks.forEach((cb: ECSTickCallback) => cb());
        this._systems.forEach((_: ECSSystem, uid: string) => this.runSystem(uid));
        this._onTickEndCallbacks.forEach((cb: ECSTickCallback) => cb());
    }

    public static get instance(): ECS {
        if (!ECS._instance) {
            ECS._instance = new ECS();
        }

        return ECS._instance;
    }

    private static _instance: ECS;

    private constructor() { }
}
