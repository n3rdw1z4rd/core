import { distance2d } from '.';

/**
 * Mutable 2D vector with chainable arithmetic methods. Unlike {@link XY},
 * this is a class with behavior, not just a plain readonly shape.
 */
export class Vector {
    x: number;
    y: number;

    constructor(x: number = 0, y: number = 0) {
        this.x = x;
        this.y = y;
    }

    /** Returns a new `Vector` with the same `x`/`y`. */
    clone(): Vector {
        return new Vector(this.x, this.y);
    }

    /** Euclidean distance to another vector. */
    distanceTo(that: Vector): number {
        return distance2d(
            this.x, this.y,
            that.x, that.y,
        );
    }

    /** Returns a new `Vector` with `x`/`y` floored (does not mutate `this`). */
    floored(): Vector {
        return new Vector(
            Math.floor(this.x),
            Math.floor(this.y),
        );
    }

    /**
     * Adds `x`/`y` (or another `Vector`) in place and returns `this` for
     * chaining. If only `x` is given, it's added to both axes.
     */
    plus(x: number | Vector, y?: number): this {
        if (x instanceof Vector) {
            y = x.y;
            x = x.x;
        } else if (y === undefined) {
            y = x;
        }

        this.x += x;
        this.y += y;

        return this;
    }

    /** Subtracts `x`/`y` (or another `Vector`) in place. See {@link plus}. */
    minus(x: number | Vector, y?: number): this {
        if (x instanceof Vector) {
            y = x.y;
            x = x.x;
        } else if (y === undefined) {
            y = x;
        }

        this.x -= x;
        this.y -= y;

        return this;
    }

    /** Multiplies `x`/`y` (or another `Vector`) in place. See {@link plus}. */
    times(x: number | Vector, y?: number): this {
        if (x instanceof Vector) {
            y = x.y;
            x = x.x;
        } else if (y === undefined) {
            y = x;
        }

        this.x *= x;
        this.y *= y;

        return this;
    }

    /**
     * Divides `x`/`y` (or another `Vector`) in place. See {@link plus}.
     * A `0` divisor is treated as `1` to avoid producing `Infinity`/`NaN`.
     */
    dividedBy(x: number | Vector, y?: number): this {
        if (x instanceof Vector) {
            y = x.y;
            x = x.x;
        } else if (y === undefined) {
            y = x;
        }

        this.x /= (x || 1);
        this.y /= (y || 1);

        return this;
    }

    /** Unit vector pointing up (`-y`), assuming a screen/grid Y-down convention. */
    static get NORTH(): Vector { return new Vector(0, -1); }
    /** Unit vector pointing down (`+y`). */
    static get SOUTH(): Vector { return new Vector(0, 1); }
    /** Unit vector pointing right (`+x`). */
    static get EAST(): Vector { return new Vector(1, 0); }
    /** Unit vector pointing left (`-x`). */
    static get WEST(): Vector { return new Vector(-1, 0); }
}
