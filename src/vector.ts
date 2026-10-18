import { distance2d } from "./math";
import type { XY } from "./types";

/**
 * Mutable 2D vector. Most methods modify the vector in place and return `this` for chaining;
 * {@link Vector.clone} and {@link Vector.floored} return new vectors.
 *
 * ```ts
 * const v = new Vector(3, 4);
 * v.length();                          // 5
 * v.clone().normalize().times(10);     // (6, 8), v unchanged
 * v.plus(1).minus(new Vector(0, 2));   // v is now (4, 3)
 * ```
 * @category Math & Random
 */
export class Vector {
    /** horizontal component */
    x: number;
    /** vertical component (down in screen coordinates) */
    y: number;

    constructor(x: number = 0, y: number = 0) {
        this.x = x;
        this.y = y;
    }

    /** A new vector with the same components. */
    clone(): Vector {
        return new Vector(this.x, this.y);
    }

    /** Copies `that`'s components into this vector. */
    copy(that: Vector): this {
        this.x = that.x;
        this.y = that.y;

        return this;
    }

    /** Writes this vector's components into `target`; returns this vector, not `target`. */
    copyTo(target: { x: number; y: number }): this {
        target.x = this.x;
        target.y = this.y;

        return this;
    }

    /** Sets both components. */
    set(x: number, y: number): this {
        this.x = x;
        this.y = y;

        return this;
    }

    /** Exact (`===`) component-wise equality. */
    equals(that: Vector): boolean {
        return this.x === that.x && this.y === that.y;
    }

    /** Euclidean distance to `that`. */
    distanceTo(that: Vector): number {
        return distance2d(
            this.x, this.y,
            that.x, that.y,
        );
    }

    /** Euclidean length (magnitude). */
    length(): number {
        return Math.hypot(this.x, this.y);
    }

    /** Scales to unit length in place; a zero vector is left unchanged. */
    normalize(): this {
        const length = this.length();

        if (length > 0) {
            this.dividedBy(length);
        }

        return this;
    }

    /** Scales to the given length in place, keeping the direction; a zero vector stays zero. */
    setLength(length: number): this {
        return this.normalize().times(length);
    }

    /** Dot product with `that`. */
    dot(that: Vector): number {
        return (this.x * that.x) + (this.y * that.y);
    }

    /** Direction in radians, `Math.atan2(y, x)`, in (-π, π]. */
    angle(): number {
        return Math.atan2(this.y, this.x);
    }

    /** Unsigned angle between this vector and `that`, in radians in [0, π]; 0 if either is a zero vector. */
    angleTo(that: Vector): number {
        const denominator = this.length() * that.length();

        if (denominator === 0) {
            return 0;
        }

        const theta = this.dot(that) / denominator;

        return Math.acos(Math.min(1, Math.max(-1, theta)));
    }

    /** Rotates in place about the origin by `radians` (counter-clockwise with y up, clockwise on screen with y down). */
    rotate(radians: number): this {
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);

        const { x, y } = this;

        this.x = x * cos - y * sin;
        this.y = x * sin + y * cos;

        return this;
    }

    /** Rotates in place about `origin` by `radians`. */
    rotateAround(origin: Vector, radians: number): this {
        return this
            .minus(origin)
            .rotate(radians)
            .plus(origin);
    }

    /** A new vector with both components floored; this vector is unchanged. */
    floored(): Vector {
        return new Vector(
            Math.floor(this.x),
            Math.floor(this.y),
        );
    }

    /** Adds in place: another vector, a scalar to both components (`plus(n)`), or separate `x` and `y` amounts. */
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

    /** Subtracts in place; arguments as for {@link Vector.plus}. */
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

    /** Multiplies component-wise in place; arguments as for {@link Vector.plus}. */
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
     * Divides component-wise in place; arguments as for {@link Vector.plus}. A zero divisor is
     * treated as 1, so that component is left unchanged.
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

    /** A new vector from any `{ x, y }` object. */
    static from(value: XY): Vector {
        return new Vector(value.x, value.y);
    }

    /** new (0, 0) */
    static get ZERO(): Vector { return new Vector(0, 0); }
    /** new (0, -1): up in screen coordinates (y down) */
    static get NORTH(): Vector { return new Vector(0, -1); }
    /** new (0, 1): down in screen coordinates */
    static get SOUTH(): Vector { return new Vector(0, 1); }
    /** new (1, 0) */
    static get EAST(): Vector { return new Vector(1, 0); }
    /** new (-1, 0) */
    static get WEST(): Vector { return new Vector(-1, 0); }
}