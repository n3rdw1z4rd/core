import { distance2d } from '.';

export class Vector {
    x: number;
    y: number;

    constructor(x: number = 0, y: number = 0) {
        this.x = x;
        this.y = y;
    }

    clone(): Vector {
        return new Vector(this.x, this.y);
    }

    distanceTo(that: Vector): number {
        return distance2d(
            this.x, this.y,
            that.x, that.y,
        );
    }

    floored(): Vector {
        return new Vector(
            Math.floor(this.x),
            Math.floor(this.y),
        );
    }

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

    static get NORTH(): Vector { return new Vector(0, -1); }
    static get SOUTH(): Vector { return new Vector(0, 1); }
    static get EAST(): Vector { return new Vector(1, 0); }
    static get WEST(): Vector { return new Vector(-1, 0); }
}
