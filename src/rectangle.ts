import { Vector } from "./vector";

/**
 * Axis-aligned rectangle given by its top-left corner (`x`, `y`) and size. Edges are inclusive
 * in the containment and intersection tests.
 * @category Math & Random
 */
export class Rectangle {
    /** left edge */
    x: number;
    /** top edge (minimum y; y points down) */
    y: number;
    /** extent along x from `x` */
    width: number;
    /** extent along y from `y` */
    height: number;

    /** Defaults to a 1 x 1 rectangle at the origin. */
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
     * For a {@link Vector}: true if the point is inside or on the edge, with the rectangle grown by
     * `padding` on every side. For a {@link Rectangle}: true if `target` lies entirely inside, with
     * this rectangle shrunk by `padding` on every side.
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

    /**
     * True if the rectangles overlap or touch. `padding` is added around both rectangles, so they
     * also count as intersecting when up to `2 * padding` apart.
     */
    intersects(other: Rectangle, padding: number = 0): boolean {
        return !(
            other.x - padding > this.x + this.width + padding ||
            other.x + other.width + padding < this.x - padding ||
            other.y - padding > this.y + this.height + padding ||
            other.y + other.height + padding < this.y - padding
        );
    }

    /** A new vector at the rectangle's centre. */
    center(): Vector {
        return new Vector(
            this.x + this.width / 2,
            this.y + this.height / 2
        );
    }

    /** Distance between the two rectangles' centres. */
    distanceTo(other: Rectangle): number {
        return this.center().distanceTo(other.center());
    }

    /** A new rectangle with the same position and size. */
    clone(): Rectangle {
        return new Rectangle(this.x, this.y, this.width, this.height);
    }

    /** Exact (`===`) equality of position and size. */
    equals(other: Rectangle): boolean {
        return (
            this.x === other.x &&
            this.y === other.y &&
            this.width === other.width &&
            this.height === other.height
        );
    }

    /** A new rectangle expanded by `padding` on every side (negative shrinks); this one is unchanged. */
    grow(padding: number): Rectangle {
        return new Rectangle(
            this.x - padding,
            this.y - padding,
            this.width + padding * 2,
            this.height + padding * 2
        );
    }

    /** True if `vec` is inside or on the edge, with the rectangle grown by `padding`; same as {@link Rectangle.contains} with a vector. */
    vectorInside(vec: Vector, padding: number = 0): boolean {
        return (
            vec.x >= this.x - padding && vec.x <= this.x + this.width + padding &&
            vec.y >= this.y - padding && vec.y <= this.y + this.height + padding
        );
    }
}
