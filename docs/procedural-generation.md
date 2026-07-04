# Procedural Generation

`import { ... } from "@n3rdw1z4rd/core";`

## AStar

Grid-based A* over a [`Map2D`](2d-primitives.md), 4-directional movement, Manhattan-distance heuristic.

```ts
interface AStarPoint { x: number, y: number }

interface AStarFindPathParams {
    useAdjacent?: boolean;      // currently always treated as true, see note below
    walkableValues?: number[];  // which Map2D cell values count as walkable; default [0]
}

class AStar {
    constructor(map: Map2D);
    findPath(a: AStarPoint, b: AStarPoint, params?: AStarFindPathParams): AStarPoint[];
}
```

```ts
import { AStar, Map2D } from "@n3rdw1z4rd/core";

const map = new Map2D(-1); // -1 = wall/unset
map.set(0, 0, 0);          // 0 = floor
// ... plot the rest of the level ...

const path = new AStar(map).findPath({ x: 0, y: 0 }, { x: 10, y: 10 });
```

`findPath()` returns an empty array if no path exists. **Known limitation carried over from the original implementation:** `useAdjacent` is hard-coded to `true` internally - setting it to `false` via `params` used to cause an infinite loop in the source project, so that path is disabled rather than exposed broken. With `useAdjacent` effectively always on, the path terminates as soon as it reaches any cell orthogonally adjacent to the target, not just the target cell itself.

## PoissonDiskSampler

Bridson's algorithm for blue-noise point sampling (points spread roughly evenly, no two closer than `minDist`).

```ts
function PoissonDiskSampler(
    width: number,
    height: number,
    minDist: number,
    maxPoints?: number, // candidate points tried per active sample before giving up on it, default 30
): { x: number, y: number }[];
```

```ts
import { PoissonDiskSampler } from "@n3rdw1z4rd/core";

const points = PoissonDiskSampler(500, 500, 20); // spread points at least 20px apart across a 500x500 area
```

## Dungeon generator

Rectangle-based room placement + minimum-spanning-tree corridor connection (with optional extra loop-forming paths), built on `Rectangle`, `Map2D`, `AStar`, and `rng.parkMillerNormal()` for room aspect ratios.

```ts
const TILE_EMPTY = 0;
const TILE_FLOOR = 1;
const TILE_PATH = 2;

interface RoomsParams {
    size?: number;          // level is size x size, default 64
    minSize?: number;       // default 3
    maxSize?: number;       // default 9
    padding?: number;       // min gap enforced between rooms, default 1
    maxIterations?: number; // placement attempts before giving up, default 1000
}

interface PathsParams {
    timeout?: number;             // ms budget for MST connection, default 10000
    extraPaths?: number;          // how many extra MST-rejected edges to consider adding as loops, default 0
    extraPathDensity?: number;    // chance [0,1] each candidate extra edge is actually added, default 0.1
    astarFindPathParams?: AStarFindPathParams;
}

interface DoorsParams {
    chanceExists?: number; // chance [0,1] a candidate doorway becomes a door, default 0.5
}

interface GenerateRoomsParams {
    map?: Map2D;
    rooms?: RoomsParams;
    paths?: PathsParams;
}

function GenerateRooms(params?: GenerateRoomsParams): { map: Map2D, rooms: Rectangle[], paths: XY[][] };
function GenerateDoors(map: Map2D, paths: XY[][], params?: DoorsParams): XY[];
function GenerateWalls(map: Map2D): XY[]; // all empty cells 8-directionally adjacent to a filled cell
```

```ts
import { GenerateRooms, GenerateDoors, GenerateWalls } from "@n3rdw1z4rd/core";

const { map, rooms, paths } = GenerateRooms({ rooms: { size: 80, minSize: 4, maxSize: 10 } });
const doors = GenerateDoors(map, paths);
const walls = GenerateWalls(map);
```

Rooms are placed by random rejection sampling (retry until `maxIterations` non-overlapping placements are found or the budget runs out), then connected via a minimum spanning tree over room-center distances (using `heap-js`'s `Heap` as the priority queue), with corridors carved by running `AStar` between the two closest edge points of each connected room pair. `DoorsParams`/`GenerateDoors` looks for corridor endpoints that sit in a wall-like gap (empty cells on both perpendicular sides) to place doors.
