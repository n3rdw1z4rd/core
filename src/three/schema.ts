/**
 * Component schemas: what fields a component type has, their types, defaults and ranges.
 *
 * A schema is what lets an editor work with components it has never seen: the inspector,
 * the scene serializer and (later) graph nodes are all generated from it.
 *
 * Two ways to declare a component type, producing the same {@link ComponentType}:
 *
 * ```ts
 * // a class with standard (TC39) decorators — needs the `decorators()` Vite plugin
 * // from `@n3rdw1z4rd/core/vite` until browsers run decorators natively
 * @component('RigidBody')
 * class RigidBody {
 *     @field({ type: 'enum', options: ['dynamic', 'fixed', 'kinematic'] }) kind = 'dynamic';
 *     @field({ min: 0, step: 0.1 }) mass = 1;
 *     @field() velocity = new Vector3();
 * }
 *
 * // plain data — no decorators, works anywhere (e.g. in a worker or a user script)
 * const Health = defineComponent('Health', {
 *     value: { type: 'number', default: 100, min: 0 },
 *     regen: { type: 'boolean', default: false },
 * });
 * ```
 *
 * @module
 */

/** @category ECS */
export type FieldType = 'number' | 'boolean' | 'string' | 'color' | 'vec2' | 'vec3' | 'enum' | 'entity' | 'asset';

/**
 * One field of a component schema.
 *
 * @category ECS
 */
export interface FieldDef {
    type: FieldType;
    /** the value a new component starts with */
    default?: unknown;
    /** shown instead of the field name */
    label?: string;
    min?: number;
    max?: number;
    step?: number;
    /** the choices of an `enum` field */
    options?: readonly string[];
    /** kept and saved, but not shown in an inspector */
    hidden?: boolean;
    /** saved, but not editable in an inspector */
    readonly?: boolean;
    /** not saved with the scene (runtime-only state) */
    transient?: boolean;
    /**
     * Editor hint: show the field only while this returns true for the component, e.g.
     * `showIf: (shape) => shape.kind === 'box'`. Not saved (schemas aren't).
     */
    showIf?: (component: any) => boolean;
}

/** @category ECS */
export interface ComponentSchema {
    /** unique among registered types; the key the component is stored and saved under */
    name: string;
    fields: Record<string, FieldDef>;
}

/**
 * A component type: its schema, and how to make an instance.
 *
 * @category ECS
 */
export interface ComponentType<T extends object = any> {
    readonly schema: ComponentSchema;
    /** the class, for class-based types */
    readonly ctor?: new () => T;
    /** a new instance with the defaults, then `data` (raw JSON or live values) applied */
    create(data?: Partial<Record<keyof T, unknown>> | Record<string, unknown>): T;
}

/* ------------------------------------------------------------------ */
/* Field values <-> JSON                                                */
/* ------------------------------------------------------------------ */

const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null;

/** Works out a field's type from a value, e.g. a class field's initial value. */
export function inferFieldType(value: unknown): FieldType {
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (isObj(value)) {
        if (value.isColor) return 'color';
        if (value.isVector3 || ('z' in value && 'x' in value && 'y' in value)) return 'vec3';
        if (value.isVector2 || ('x' in value && 'y' in value)) return 'vec2';
    }
    return 'string';
}

/** A field value as plain JSON: vectors become arrays, colors `#rrggbb` strings. */
export function fieldToJson(def: FieldDef, value: unknown): unknown {
    switch (def.type) {
        case 'vec2':
            return isObj(value) ? [value.x ?? 0, value.y ?? 0] : value;
        case 'vec3':
            return isObj(value) ? [value.x ?? 0, value.y ?? 0, value.z ?? 0] : value;
        case 'color':
            return isObj(value) && value.isColor ? `#${value.getHexString()}` : value;
        default:
            return isObj(value) ? structuredClone(value) : value;
    }
}

/**
 * Applies a JSON (or live) value to a field. When the field currently holds a three.js
 * object (a `Vector3`, a `Color`…) it is updated in place, so references to it stay valid.
 */
export function applyFieldValue(target: Record<string, any>, key: string, def: FieldDef, json: unknown): void {
    const current = target[key];

    if (def.type === 'vec2' || def.type === 'vec3') {
        const [x, y, z] = Array.isArray(json) ? json : isObj(json) ? [json.x, json.y, json.z] : [];
        if (isObj(current) && typeof current.set === 'function') {
            def.type === 'vec3' ? current.set(x ?? 0, y ?? 0, z ?? 0) : current.set(x ?? 0, y ?? 0);
        } else {
            target[key] = def.type === 'vec3' ? { x: x ?? 0, y: y ?? 0, z: z ?? 0 } : { x: x ?? 0, y: y ?? 0 };
        }
        return;
    }

    if (def.type === 'color' && isObj(current) && current.isColor) {
        if (isObj(json) && json.isColor) current.copy(json);
        else current.set(json as any);
        return;
    }

    target[key] = isObj(json) ? structuredClone(json) : json;
}

/** The saved form of a component: every non-transient field, as JSON. */
export function componentToJson(type: ComponentType, component: Record<string, any>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, def] of Object.entries(type.schema.fields)) {
        if (!def.transient) out[key] = fieldToJson(def, component[key]);
    }
    return out;
}

function applyData(type: ComponentType, instance: Record<string, any>, data?: Record<string, unknown>): void {
    if (!data) return;
    for (const [key, def] of Object.entries(type.schema.fields)) {
        if (key in data) applyFieldValue(instance, key, def, data[key]);
    }
}

/* ------------------------------------------------------------------ */
/* Plain-data component types                                           */
/* ------------------------------------------------------------------ */

/**
 * Declares a component type from plain field definitions; instances are plain objects.
 *
 * @category ECS
 */
export function defineComponent<F extends Record<string, FieldDef>>(
    name: string,
    fields: F,
    registry: ComponentRegistry | null = components,
): ComponentType<{ [K in keyof F]: any }> {
    const type: ComponentType = {
        schema: { name, fields: { ...fields } },
        create(data) {
            const instance: Record<string, any> = {};
            for (const [key, def] of Object.entries(fields)) {
                instance[key] = isObj(def.default) ? structuredClone(def.default) : def.default ?? defaultFor(def);
            }
            applyData(type, instance, data as Record<string, unknown>);
            return instance;
        },
    };
    registry?.register(type);
    return type;
}

function defaultFor(def: FieldDef): unknown {
    switch (def.type) {
        case 'number': return def.min !== undefined && def.min > 0 ? def.min : 0;
        case 'boolean': return false;
        case 'color': return '#ffffff';
        case 'vec2': return { x: 0, y: 0 };
        case 'vec3': return { x: 0, y: 0, z: 0 };
        case 'enum': return def.options?.[0] ?? '';
        case 'entity': return null;
        default: return '';
    }
}

/* ------------------------------------------------------------------ */
/* Class-based component types (standard decorators)                    */
/* ------------------------------------------------------------------ */

// esbuild and TypeScript fall back to Symbol.for('Symbol.metadata') where Symbol.metadata is missing
const METADATA: symbol = (Symbol as any).metadata ?? Symbol.for('Symbol.metadata');
const FIELDS = Symbol('n3rdw1z4rd.fields');

type FieldOptions = Partial<FieldDef>;

/**
 * Field decorator: marks a class field as part of the component's schema. The type is
 * inferred from the initial value when not given.
 *
 * @category ECS
 */
export function field(options: FieldOptions = {}) {
    return function (_value: undefined, context: ClassFieldDecoratorContext): void {
        if (context.static || context.private) throw new Error('@field: only public instance fields can be fields');
        const meta = context.metadata as Record<symbol, any>;
        // metadata objects inherit from the parent class's; copy so subclasses don't write into it
        if (!Object.hasOwn(meta, FIELDS)) meta[FIELDS] = { ...(meta[FIELDS] ?? {}) };
        meta[FIELDS][String(context.name)] = options;
    };
}

/**
 * Class decorator: registers the class as a component type (in the default registry, or
 * the one given). Give it a name: class names don't survive minification.
 *
 * @category ECS
 */
export function component(name?: string, registry: ComponentRegistry = components) {
    return function <C extends new () => object>(ctor: C, context: ClassDecoratorContext<C>): void {
        context.addInitializer(() => {
            registry.register(componentType(ctor, name ?? String(context.name)));
        });
    };
}

const classTypes = new WeakMap<Function, ComponentType>();

/**
 * The {@link ComponentType} for a class with `@field`s (made once, then cached). Field types
 * and defaults come from a fresh instance.
 *
 * @category ECS
 */
export function componentType<T extends object>(ctor: new () => T, name: string = ctor.name): ComponentType<T> {
    const cached = classTypes.get(ctor);
    if (cached) return cached;

    const declared: Record<string, FieldOptions> = (ctor as any)[METADATA]?.[FIELDS] ?? {};
    const sample = new ctor() as Record<string, any>;
    const fields: Record<string, FieldDef> = {};

    for (const [key, opts] of Object.entries(declared)) {
        const type = opts.type ?? (opts.options ? 'enum' : inferFieldType(sample[key]));
        fields[key] = { ...opts, type, default: fieldToJson({ type }, sample[key]) };
    }

    const type: ComponentType<T> = {
        schema: { name, fields },
        ctor,
        create(data) {
            const instance = new ctor();
            applyData(type, instance as Record<string, any>, data as Record<string, unknown>);
            return instance;
        },
    };

    classTypes.set(ctor, type);
    return type;
}

/* ------------------------------------------------------------------ */
/* Registry                                                             */
/* ------------------------------------------------------------------ */

/**
 * Component types by name (and by class). Scenes are saved with type names and loaded
 * through a registry.
 *
 * @category ECS
 */
export class ComponentRegistry {
    private readonly byName = new Map<string, ComponentType>();

    register(type: ComponentType): ComponentType {
        const existing = this.byName.get(type.schema.name);
        if (existing && existing !== type) {
            // hot module reload re-runs the declaration; the newest one wins
            console.warn(`ComponentRegistry: replacing component type "${type.schema.name}"`);
        }
        this.byName.set(type.schema.name, type);
        return type;
    }

    get(name: string): ComponentType | undefined {
        return this.byName.get(name);
    }

    has(name: string): boolean {
        return this.byName.has(name);
    }

    /** The type of a name, class, type or instance (via its constructor); undefined if unknown. */
    resolve(ref: string | ComponentType | (new () => object) | object): ComponentType | undefined {
        if (typeof ref === 'string') return this.get(ref);
        if (typeof ref === 'function') {
            const t = classTypes.get(ref);
            return t && this.get(t.schema.name) === t ? t : undefined;
        }
        if ('schema' in ref && 'create' in ref) return ref as ComponentType;
        return this.resolve((ref as object).constructor as new () => object);
    }

    /** every registered type, e.g. for an "add component" menu */
    all(): ComponentType[] {
        return [...this.byName.values()];
    }
}

/**
 * The default registry, used by `@component` and {@link defineComponent} unless given another.
 *
 * @category ECS
 */
export const components = new ComponentRegistry();
