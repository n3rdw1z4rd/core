# 2D Primitives

`import { ... } from "@n3rdw1z4rd/core";`

## Vector

A small mutable 2D vector. Most methods (`plus`/`minus`/`times`/`dividedBy`) mutate `this` and return it for chaining, accepting either two numbers or another `Vector`.

```ts
class Vector {
    x: number;
    y: number;

    constructor(x?: number, y?: number);
    clone(): Vector;
    distanceTo(that: Vector): number;
    floored(): Vector;                                  // new Vector with Math.floor'd components
    plus(x: number | Vector, y?: number): this;
    minus(x: number | Vector, y?: number): this;
    times(x: number | Vector, y?: number): this;
    dividedBy(x: number | Vector, y?: number): this;     // dividing by 0 is treated as dividing by 1

    static get NORTH(): Vector; // (0, -1)
    static get SOUTH(): Vector; // (0, 1)
    static get EAST(): Vector;  // (1, 0)
    static get WEST(): Vector;  // (-1, 0)
}
```

```ts
import { Vector } from "@n3rdw1z4rd/core;

const pos = new Vector(3, 4);
pos.plus(Vector.EAST).plus(1, -1); // mutates pos in place, returns pos
```

## Rectangle

Axis-aligned rectangle with `Vector`-aware containment/intersection checks.

```ts
class Rectangle {
    x: number; y: number; width: number; height: number;

    constructor(x?: number, y?: number, width?: number, height?: number);
    area(): number;
    contains(target: Vector | Rectangle, padding?: number): boolean;
    intersects(other: Rectangle, padding?: number): boolean;
    center(): Vector;
    distanceTo(other: Rectangle): number; // distance between centers
    clone(): Rectangle;
    equals(other: Rectangle): boolean;
    grow(padding: number): Rectangle;      // returns a new, larger Rectangle
    vectorInside(vec: Vector, padding?: number): boolean;
}
```

Used internally by [the dungeon generator](procedural-generation.md) for room placement/connection.

## Map2D / Map3D

Sparse, string-keyed coordinate maps - only occupied cells actually take up space in the underlying `Map`. Coordinates are floored before lookup, so you can pass fractional positions directly.

```ts
class Map2D {
    readonly defaultValue: number; // returned by get() for unset cells, default -1
    readonly size: number;

    constructor(defaultValue?: number);
    clear(): void;
    get(x: number, y: number, defaultValue?: number): number;
    set(x: number, y: number, value?: number): void; // setting to defaultValue deletes the cell
    forEach(callback: (x: number, y: number, v: number) => void): void;
}

class Map3D {
    readonly defaultValue: number;
    readonly data: Map<string, number>;

    constructor(defaultValue?: number);
    clear(): void;
    get(x: number, y: number, z: number, defaultValue?: number): number;
    set(x: number, y: number, z: number, value?: number): void;
    forEach(callback: (x: number, y: number, z: number, v: number) => void): void;
}
```

Both store plain `number` values only (e.g. a tile ID or voxel type) - if you need arbitrary payloads per cell, use `Tilemap<T>` instead.

## Tilemap

A generic version of the same sparse-grid idea, for when a cell needs to hold more than a single number.

```ts
class Tilemap<T = number> {
    map: Map<string, T>;

    get(x: number, y: number): T | undefined;
    set(x: number, y: number, v: T): void;
}
```

```ts
import { Tilemap } from "@n3rdw1z4rd/core";

interface Tile { type: string, discovered: boolean }

const tiles = new Tilemap<Tile>();
tiles.set(3, 4, { type: 'wall', discovered: false });
```

## types.ts

A few small shared type aliases used across the package, also available directly:

```ts
type KeyValue = { [key: string]: any };
type XY = { x: number, y: number };       // used by AStar, the dungeon generator, etc.
type JSONValue = string | number | boolean | null | JSONValue[] | { [key: string]: JSONValue };
type DataJson = { [k: string]: JSONValue };
```
