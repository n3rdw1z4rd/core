import { Vector } from '.';

/** Axis-aligned rectangle defined by its top-left corner and size. */
export class Rectangle {
    x: number;
    y: number;
    width: number;
    height: number;

    constructor(x: number = 0, y: number = 0, width: number = 1, height: number = 1) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height
    }

    /** `width * height`. */
    area(): number {
        return this.width * this.height;
    }

    /**
     * Whether `target` (a point or another rectangle) lies within this
     * rectangle, optionally expanded/shrunk by `padding`.
     */
    contains(target: Vector | Rectangle, padding: number = 0): boolean {
        return (target instanceof Vector)
            ? (
                target.x >= this.x - padding &&
                target.x <= this.x + this.width + padding &&
                target.y >= this.y - padding &&
                target.y <= this.y + this.height + padding
            )
            : (
                target.x >= this.x + padding &&
                target.y >= this.y + padding &&
                target.x + target.width <= this.x + this.width - padding &&
                target.y + target.height <= this.y + this.height - padding
            );
    }

    /** Whether this rectangle overlaps `other`, optionally padded. */
    intersects(other: Rectangle, padding: number = 0): boolean {
        return !(
            other.x - padding > this.x + this.width + padding ||
            other.x + other.width + padding < this.x - padding ||
            other.y - padding > this.y + this.height + padding ||
            other.y + other.height + padding < this.y - padding
        );
    }

    /** Midpoint of the rectangle, as a new {@link Vector}. */
    center(): Vector {
        return new Vector(
            this.x + this.width / 2,
            this.y + this.height / 2
        );
    }

    /** Distance between the centers of this rectangle and `other`. */
    distanceTo(other: Rectangle): number {
        return this.center().distanceTo(other.center());
    }

    /** Returns a new `Rectangle` with the same position and size. */
    clone(): Rectangle {
        return new Rectangle(this.x, this.y, this.width, this.height);
    }

    /** Whether `other` has the same position and size. */
    equals(other: Rectangle): boolean {
        return (
            this.x === other.x &&
            this.y === other.y &&
            this.width === other.width &&
            this.height === other.height
        );
    }

    /** Returns a new `Rectangle` expanded by `padding` on all sides (negative shrinks it). */
    grow(padding: number): Rectangle {
        return new Rectangle(
            this.x - padding,
            this.y - padding,
            this.width + padding * 2,
            this.height + padding * 2
        );
    }

    /** Alias for {@link contains} restricted to a `Vector` target. */
    vectorInside(vec: Vector, padding: number = 0): boolean {
        return (
            vec.x >= this.x - padding && vec.x <= this.x + this.width + padding &&
            vec.y >= this.y - padding && vec.y <= this.y + this.height + padding
        );
    }
}
