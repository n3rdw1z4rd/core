/**
 * Pin types. A type is a name (`number`, `vec2`, `entity`…) with a color for the editor;
 * a trailing `[]` in a port declaration (`vec2[]`) makes the port a **list port** — it takes
 * or produces a whole list instead of one value at a time (see {@link GraphEvaluator}).
 *
 * `any` connects to everything. Other compatibility is declared with `accepts`:
 * `types.define('vec2', '#4ea8de', { accepts: ['number'] })` would let a number plug into a
 * vec2 pin (the node then gets the number as-is — coercion is the node's business).
 *
 * @module
 */

/** @category Graph */
export interface PortTypeDef {
    name: string;
    /** pin / wire color in the editor */
    color: string;
    /** other types that may connect into a pin of this type */
    accepts: string[];
}

/** A parsed port type: `vec2[]` → `{ base: 'vec2', list: true }`. @category Graph */
export interface ParsedType {
    base: string;
    list: boolean;
}

/** @category Graph */
export function parseType(type: string): ParsedType {
    const t = type.trim();
    return t.endsWith('[]') ? { base: t.slice(0, -2).trim(), list: true } : { base: t, list: false };
}

/**
 * Known pin types and which connect to which.
 *
 * @category Graph
 */
export class TypeRegistry {
    private readonly types = new Map<string, PortTypeDef>();

    constructor() {
        this.define('any', '#9a9a9a');
    }

    define(name: string, color: string, options: { accepts?: string[] } = {}): PortTypeDef {
        const def = { name, color, accepts: options.accepts ?? [] };
        this.types.set(name, def);
        return def;
    }

    get(name: string): PortTypeDef | undefined {
        return this.types.get(parseType(name).base);
    }

    /** The color for a type (unknown types get `any`'s). */
    color(name: string): string {
        return (this.get(name) ?? this.types.get('any')!).color;
    }

    /**
     * Whether an output of type `from` may connect to an input of type `to`. List-ness never
     * blocks a connection: one value into a list port becomes a one-item list, and a list
     * into a single-value port broadcasts.
     */
    canConnect(from: string, to: string): boolean {
        const a = parseType(from).base;
        const b = parseType(to).base;
        if (a === b || a === 'any' || b === 'any') return true;
        return this.types.get(b)?.accepts.includes(a) ?? false;
    }

    all(): PortTypeDef[] {
        return [...this.types.values()];
    }
}

/**
 * The default pin types (colors match the apparatus palette).
 *
 * @category Graph
 */
export const portTypes = new TypeRegistry();
portTypes.define('number', '#3fd1a4');
portTypes.define('boolean', '#e8554e');
portTypes.define('string', '#e86fb0');
portTypes.define('color', '#f2a541');
portTypes.define('vec2', '#4ea8de');
portTypes.define('vec3', '#9b6dde');
