/**
 * An entity id: a plain integer handed out by {@link ECS.createEntity}.
 *
 * @category ECS
 */
export type Entity = number;
/**
 * Any object used as a component. Components are stored by their constructor, so each entity holds
 * at most one component per class.
 *
 * @category ECS
 */
export type Component = object;

/**
 * A component class; used as the key for lookups and queries.
 *
 * @category ECS
 */
export type ComponentType<T extends Component = Component> = new (...args: any[]) => T;

type ComponentMap<T extends Component = Component> = Map<Entity, T>;

/**
 * The component instances for a tuple of component types, as yielded by {@link ECS.query}.
 *
 * @category ECS
 */
export type ComponentInstances<T extends readonly ComponentType[]> = {
    [K in keyof T]:
    T[K] extends ComponentType<infer U> ? U : never;
};

/**
 * A function run once per frame with the elapsed time. Not used by {@link ECS} itself; a convention
 * for callers that keep their own system list.
 *
 * @category ECS
 */
export type System = (deltaTime: number) => void;

/**
 * A minimal entity-component store. Entities are integers; components are class instances stored
 * per class, and {@link ECS.query} iterates the entities that have every requested component.
 *
 * ```ts
 * class Position { constructor(public x = 0, public y = 0) {} }
 * class Velocity { constructor(public x = 0, public y = 0) {} }
 *
 * const world = new ECS();
 * const e = world.createEntity();
 * world.addComponent(e, new Position());
 * world.addComponent(e, new Velocity(1, 0));
 *
 * for (const [entity, pos, vel] of world.query(Position, Velocity)) {
 *     pos.x += vel.x;
 * }
 * ```
 *
 * @category ECS
 */
export class ECS {
    #nextEntity = 0;

    private readonly components = new Map<ComponentType, ComponentMap>();

    /** Returns a new entity id (0, 1, 2, ...). Ids are never reused until {@link ECS.clear}. */
    createEntity(): Entity {
        return this.#nextEntity++;
    }

    /**
     * Attaches `component` to `entity`, keyed by `component.constructor`; replaces any existing
     * component of the same class.
     */
    addComponent<T extends Component>(
        entity: Entity,
        component: T,
    ): void {
        const type = component.constructor as ComponentType<T>;

        let map = this.components.get(type) as ComponentMap<T> | undefined;

        if (!map) {
            map = new Map<Entity, T>();
            this.components.set(type, map);
        }

        map.set(entity, component);
    }

    /** The entity's component of class `type`, or `undefined` if it has none. */
    getComponent<T extends Component>(
        entity: Entity,
        type: ComponentType<T>,
    ): T | undefined {
        const map = this.components.get(type) as ComponentMap<T> | undefined;
        return map?.get(entity);
    }

    /** Whether the entity has a component of class `type`. */
    hasComponent<T extends Component>(
        entity: Entity,
        type: ComponentType<T>,
    ): boolean {
        return this.components.get(type)?.has(entity) ?? false;
    }

    /** Removes the entity's component of class `type`, if any. */
    removeComponent<T extends Component>(
        entity: Entity,
        type: ComponentType<T>,
    ): void {
        (this.components.get(type) as ComponentMap<T> | undefined)?.delete(entity);
    }

    /**
     * Iterates `[entity, ...components]` for every entity that has all of `types`, with the
     * components in the same order as `types`. Yields nothing when `types` is empty or any type has
     * never been added. Order follows insertion into the least-populated component type.
     */
    *query<T extends readonly ComponentType[]>(
        ...types: T
    ): IterableIterator<[Entity, ...ComponentInstances<T>]> {
        if (types.length === 0) {
            return;
        }

        let smallest: ComponentMap | undefined;
        const maps: ComponentMap[] = [];

        for (const type of types) {
            const map = this.components.get(type);

            if (!map) {
                return;
            }

            maps.push(map);

            if (!smallest || map.size < smallest.size) {
                smallest = map;
            }
        }

        if (!smallest) {
            return;
        }

        for (const entity of smallest.keys()) {
            const components: Component[] = [];
            let matches = true;

            for (const map of maps) {
                const component = map.get(entity);

                if (!component) {
                    matches = false;
                    break;
                }

                components.push(component);
            }

            if (matches) {
                yield [entity, ...(components as ComponentInstances<T>)];
            }
        }
    }

    /** Removes all of the entity's components. The id is not recycled. */
    destroyEntity(entity: Entity): void {
        for (const map of this.components.values()) {
            map.delete(entity);
        }
    }

    /** Removes every component and resets entity ids to start from 0 again. */
    clear(): void {
        this.components.clear();
        this.#nextEntity = 0;
    }
}

/**
 * A shared {@link ECS} instance.
 *
 * @category ECS
 */
export const ecs = new ECS();
