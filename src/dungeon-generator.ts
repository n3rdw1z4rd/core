import { findPath } from './astar';
import { Heap } from 'heap-js';
import { Map2D } from './map2d';
import { rng } from './rng';
import { log } from './log';
import { distance2d, squaredDistance } from './math';
import { Rectangle } from './rectangle';
import { XY } from './types';

/**
 * Two rooms to be joined by a corridor.
 *
 * @property a first room
 * @property b second room
 * @category Pathfinding & Procedural
 */
export type RectPair = { a: Rectangle, b: Rectangle };
/**
 * Two tiles, e.g. the closest edge tiles of two rooms.
 *
 * @property a first point
 * @property b second point
 * @category Pathfinding & Procedural
 */
export type PointPair = { a: XY, b: XY };

/**
 * Room placement options for {@link GenerateRooms}.
 *
 * @category Pathfinding & Procedural
 */
export interface RoomsParams {
    /** level width and height in tiles, default 64 */
    size?: number,
    /** smallest room side in tiles, default 3 */
    minSize?: number,
    /** largest room side in tiles, default 9 */
    maxSize?: number,
    /** spacing kept around each room and from the level edge in tiles, default 1 */
    padding?: number,
    /** stop after this many consecutive failed placements, default 1000 */
    maxIterations?: number,
}

/**
 * Corridor options for {@link GenerateRooms}.
 *
 * @category Pathfinding & Procedural
 */
export interface PathsParams {
    /** number of shortest unused room connections considered as extra (loop) corridors, default 0 */
    extraPaths?: number,
    /** chance (0-1) that each considered extra connection is added, default 0.1 */
    extraPathDensity?: number,
    /** tile values corridors may be carved through, default: the map's default value (empty space) */
    walkableValues?: number[],
}

/**
 * Options for {@link GenerateDoors}.
 *
 * @category Pathfinding & Procedural
 */
export interface DoorsParams {
    /** chance (0-1) that a door is placed at each eligible corridor end, default 0.5 */
    chanceExists?: number,
}

/**
 * Options for {@link GenerateRooms}.
 *
 * @category Pathfinding & Procedural
 */
export interface GenerateRoomsParams {
    /** map to draw into, default a new {@link Map2D} filled with {@link TILE_EMPTY} */
    map?: Map2D,
    /** room placement options */
    rooms?: RoomsParams,
    /** corridor options */
    paths?: PathsParams,
}

/**
 * Tile value for empty (unused) space.
 *
 * @category Pathfinding & Procedural
 */
export const TILE_EMPTY = 0;
/**
 * Tile value for room floor.
 *
 * @category Pathfinding & Procedural
 */
export const TILE_FLOOR = 1;
/**
 * Tile value for corridor floor.
 *
 * @category Pathfinding & Procedural
 */
export const TILE_PATH = 2;

const DEFAULT_LEVEL_SIZE = 64;

const DEFAULT_ROOM_MIN_SIZE = 3;
const DEFAULT_ROOM_MAX_SIZE = 9;
const DEFAULT_ROOM_PADDING = 1;
const DEFAULT_ROOM_MAX_ITERATIONS = 1000;

const DEFAULT_PATH_EXTRA_PATHS = 0;
const DEFAULT_PATH_EXTRA_PATH_DENSITY = 0.1;

const DEFAULT_DOOR_CHANCE_EXISTS = 0.5;

const DIRECTIONS_8_WAY: XY[] = [
    { x: -1, y: 0 }, // left
    { x: -1, y: -1 }, // left-up
    { x: 0, y: -1 }, // up
    { x: 1, y: -1 }, // up-right
    { x: 1, y: 0 },  // right
    { x: 1, y: 1 }, // right-down
    { x: 0, y: 1 },  // down
    { x: -1, y: 1 }, // down-left
];

function _plot(map: Map2D, data: Rectangle[] | XY[] | XY[][], tile: number) {
    data.forEach((element: Rectangle | XY | XY[]) => {
        if (element instanceof Rectangle) {
            for (let y = 0; y < element.height; y++) {
                for (let x = 0; x < element.width; x++) {
                    map.set(element.x + x, element.y + y, tile);
                }
            }
        } else if (Array.isArray(element)) {
            element.forEach((point: XY) => {
                map.set(point.x, point.y, tile);
            });
        } else {
            map.set(element.x, element.y, tile);
        }
    });
}

function _generateRooms(params: RoomsParams = {}): Rectangle[] {
    const size = params.size ?? DEFAULT_LEVEL_SIZE;
    const minRoomSize = params.minSize ?? DEFAULT_ROOM_MIN_SIZE;
    const maxRoomSize = params.maxSize ?? DEFAULT_ROOM_MAX_SIZE;
    const padding = params.padding ?? DEFAULT_ROOM_PADDING
    const maxIterations = params.maxIterations ?? DEFAULT_ROOM_MAX_ITERATIONS;

    const rooms: Rectangle[] = [];

    let iterations = 0;

    while (iterations < maxIterations) {
        const baseSize = rng.range(minRoomSize, maxRoomSize);
        const aspectRatio = 0.75 + rng.gaussian() * 0.5;

        const width = Math.min(maxRoomSize, Math.max(minRoomSize, Math.round(baseSize * aspectRatio)));
        const height = Math.min(maxRoomSize, Math.max(minRoomSize, Math.round(baseSize / aspectRatio)));

        const x = rng.range(1 + padding, size - width - padding);
        const y = rng.range(1 + padding, size - height - padding);

        const room = new Rectangle(x, y, width, height);

        // padding on both rooms: they stay at least 2 * padding apart
        if (!rooms.some((existing: Rectangle) => room.intersects(existing, padding * 2))) {
            rooms.push(room);
            iterations = 0;
        } else {
            iterations += 1;
        }
    }

    return rooms;
}

function _generateMST(rooms: Rectangle[], params: PathsParams = {}): RectPair[] {
    const extraPathLevels = params.extraPaths ?? DEFAULT_PATH_EXTRA_PATHS;
    const extraPathDensity = params.extraPathDensity ?? DEFAULT_PATH_EXTRA_PATH_DENSITY;

    const mst: RectPair[] = [];
    const extraPaths: RectPair[] = [];

    if (rooms.length < 2) return [];

    const visited = new Set<number>();
    const heap = new Heap<{ cost: number; from: number; to: number }>((a, b) => a.cost - b.cost);

    visited.add(0);

    const zeroCenter = rooms[0].center();

    for (let i = 1; i < rooms.length; i++) {
        const iCenter = rooms[i].center();

        heap.push({
            from: 0,
            to: i,
            cost: squaredDistance(
                zeroCenter.x, zeroCenter.y,
                iCenter.x, iCenter.y,
            ),
        });
    }

    while (visited.size < rooms.length) {
        let edge = heap.pop();

        while (edge && visited.has(edge.to)) {
            edge = heap.pop();
        }

        if (!edge) break;

        const { from, to } = edge;

        visited.add(to);

        mst.push({ a: rooms[from], b: rooms[to] });

        const toCenter = rooms[to].center();

        for (let i = 0; i < rooms.length; i++) {
            if (!visited.has(i)) {
                const iCenter = rooms[i].center();

                heap.push({
                    from: to,
                    to: i,
                    cost: squaredDistance(
                        toCenter.x, toCenter.y,
                        iCenter.x, iCenter.y,
                    ),
                });
            }
        }
    }

    const remainingEdges = heap.toArray().sort((a, b) => a.cost - b.cost);

    for (let i = 0; i < extraPathLevels && i < remainingEdges.length; i++) {
        const e = remainingEdges[i];

        if (rng.nextFloat() < extraPathDensity) {
            extraPaths.push({
                a: rooms[e.from],
                b: rooms[e.to],
            });
        }
    }

    return mst.concat(extraPaths);
}

function _getRectEdgePoints(rect: Rectangle): XY[] {
    const points: XY[] = [];

    const x2 = rect.x + rect.width - 1;
    const y2 = rect.y + rect.height - 1;

    // inclusive bounds: the old `<` skipped the far corner, and returned nothing for 1-wide rooms
    for (let x1 = rect.x; x1 <= x2; x1++) {
        points.push({ x: x1, y: rect.y });
        points.push({ x: x1, y: y2 });
    }

    for (let y1 = rect.y; y1 <= y2; y1++) {
        points.push({ x: rect.x, y: y1 });
        points.push({ x: x2, y: y1 });
    }

    return points;
}

function _getShortestPathBetweenRects(rectA: Rectangle, rectB: Rectangle): PointPair {
    const edgeA = _getRectEdgePoints(rectA);
    const edgeB = _getRectEdgePoints(rectB);

    let paths = { a: edgeA[0], b: edgeB[0], distance: Infinity };

    for (const a of edgeA) {
        for (const b of edgeB) {
            const d = distance2d(a.x, a.y, b.x, b.y);

            if (d < paths.distance) {
                paths = { a, b, distance: d };
            }
        }
    }

    return { a: paths.a, b: paths.b };
}

function _generatePaths(map: Map2D, rooms: Rectangle[], params: PathsParams = {}) {
    const walkable = params.walkableValues ?? [map.defaultValue];
    const cost = (x: number, y: number) => walkable.includes(map.get(x, y)) ? 1 : Infinity;

    const paths: XY[][] = [];

    _generateMST(rooms, params).forEach((rects: RectPair) => {
        const { a, b } = _getShortestPathBetweenRects(rects.a, rects.b);

        // corridors end next to the target room's edge tile, which is floor (not walkable)
        paths.push(findPath(a, b, cost, { adjacent: true, maxNodes: Infinity }));
    });

    return paths;
}

/**
 * Generates a dungeon level: scatters non-overlapping rectangular rooms, joins them with a minimum
 * spanning tree of A* corridors (plus optional extra ones) and plots both into the map as
 * {@link TILE_FLOOR} and {@link TILE_PATH}.
 *
 * Rooms are placed at random until {@link RoomsParams.maxIterations} placements in a row fail.
 * Corridors are carved only through {@link PathsParams.walkableValues} tiles; each runs from next to
 * one room's edge to next to the other's, and is empty if no route exists. Randomness comes from the
 * shared {@link rng}, so set `rng.seed` first for a reproducible level. Logs its duration.
 *
 * ```ts
 * rng.seed = 1234;
 * const { map, rooms, paths } = GenerateRooms({ rooms: { size: 48 } });
 * const doors = GenerateDoors(map, paths);
 * const walls = GenerateWalls(map);
 * ```
 *
 * @returns `map`: the given map (modified) or a new one; `rooms`: the placed rooms; `paths`: one
 * tile list per corridor
 * @category Pathfinding & Procedural
 */
export function GenerateRooms(params: GenerateRoomsParams = {}): { map: Map2D, rooms: Rectangle[], paths: XY[][] } {
    const startTime = Date.now();

    const map = params.map ?? new Map2D(TILE_EMPTY);

    const rooms: Rectangle[] = _generateRooms(params.rooms);
    _plot(map, rooms, TILE_FLOOR);

    const paths: XY[][] = _generatePaths(map, rooms, params.paths);
    _plot(map, paths, TILE_PATH);

    log('GenerateRooms: done:', Date.now() - startTime, 'ms');

    return { map, rooms, paths };
}

/**
 * Picks door tiles from the two end tiles of each corridor (corridors shorter than 2 tiles are
 * skipped). An end qualifies when both its up/down or both its left/right neighbours hold the map's
 * default value, i.e. it sits in a 1-wide gap; each qualifying end becomes a door with probability
 * {@link DoorsParams.chanceExists}, using the shared {@link rng}. Does not modify the map.
 *
 * @param paths corridors as returned by {@link GenerateRooms}
 * @returns the door tiles
 * @category Pathfinding & Procedural
 */
export function GenerateDoors(map: Map2D, paths: XY[][], params: DoorsParams = {}): XY[] {
    const chanceExists = params.chanceExists ?? DEFAULT_DOOR_CHANCE_EXISTS;

    const possibleDoorPoints: XY[] = [];

    paths.forEach((points: XY[]) => {
        if (points.length > 1) {
            possibleDoorPoints.push(points[0]);
            possibleDoorPoints.push(points[points.length - 1]);
        }
    });

    const doors: XY[] = [];

    possibleDoorPoints.forEach((doorPoint: XY) => {
        if (rng.nextFloat() < chanceExists && (
            (map.get(doorPoint.x, doorPoint.y - 1) === map.defaultValue && map.get(doorPoint.x, doorPoint.y + 1) === map.defaultValue) ||
            (map.get(doorPoint.x - 1, doorPoint.y) === map.defaultValue && map.get(doorPoint.x + 1, doorPoint.y) === map.defaultValue)
        )) {
            doors.push(doorPoint);
        }
    });

    return doors;
}

/**
 * Returns every tile holding the map's default value that touches (8-way) a non-default tile, each
 * once: the walls around all rooms and corridors. Does not modify the map.
 *
 * @category Pathfinding & Procedural
 */
export function GenerateWalls(map: Map2D): XY[] {
    const walls = new Map<string, XY>();

    map.forEach((x: number, y: number, _v: number) => {
        DIRECTIONS_8_WAY.forEach((dir: XY) => {
            const nx = dir.x + x;
            const ny = dir.y + y;

            if (map.get(nx, ny) === map.defaultValue) {
                walls.set(`${nx},${ny}`, { x: nx, y: ny }); // de-dupe tiles shared by several floor tiles
            }
        });
    });

    return [...walls.values()];
}
