import { AStar, type AStarFindPathParams } from './astar';
import { distance2d, Rectangle, squaredDistance, XY } from './math';
import { Heap } from 'heap-js';
import { log } from './logger';
import { Map2D } from './map2d';
import { rng } from './rng';

export type RectPair = { a: Rectangle, b: Rectangle };
export type PointPair = { a: XY, b: XY };

export interface RoomsParams {
    size?: number,
    minSize?: number,
    maxSize?: number,
    padding?: number,
    maxIterations?: number,
}

export interface PathsParams {
    timeout?: number,
    extraPaths?: number,
    extraPathDensity?: number,
    astarFindPathParams?: AStarFindPathParams,
}

export interface DoorsParams {
    plotDoors?: boolean,
    chanceExists?: number,
    chanceOpen?: number,
    chanceLocked?: number,
}

export interface GenerateRoomsParams {
    map?: Map2D,
    rooms?: RoomsParams,
    paths?: PathsParams,
}

export const TILE_EMPTY = 0;
export const TILE_FLOOR = 1;
export const TILE_PATH = 2;

const DEFAULT_LEVEL_SIZE = 64;

const DEFAULT_ROOM_MIN_SIZE = 3;
const DEFAULT_ROOM_MAX_SIZE = 9;
const DEFAULT_ROOM_PADDING = 1;
const DEFAULT_ROOM_MAX_ITERATIONS = 1000;

const DEFAULT_PATH_TIMEOUT = 10000;
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
        const aspectRatio = 0.75 + rng.parkMillerNormal() * 0.5;

        const width = Math.min(maxRoomSize, Math.max(minRoomSize, Math.round(baseSize * aspectRatio)));
        const height = Math.min(maxRoomSize, Math.max(minRoomSize, Math.round(baseSize / aspectRatio)));

        const x = Math.floor(rng.range(1 + padding, size - width - padding));
        const y = Math.floor(rng.range(1 + padding, size - height - padding));

        const room = new Rectangle(x, y, width, height);

        if (!rooms.some((existing: Rectangle) => room.intersects(existing, padding))) {
            rooms.push(room);
            iterations = 0;
        } else {
            iterations += 1;
        }
    }

    return rooms;
}

function _generateMST(rooms: Rectangle[], params: PathsParams = {}): RectPair[] {
    const timeout = params.timeout ?? DEFAULT_PATH_TIMEOUT;
    const extraPathLevels = params.extraPaths ?? DEFAULT_PATH_EXTRA_PATHS;
    const extraPathDensity = params.extraPathDensity ?? DEFAULT_PATH_EXTRA_PATH_DENSITY;

    const startTime = Date.now();

    const mst: RectPair[] = [];
    const extraPaths: RectPair[] = [];

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

    while (visited.size < rooms.length && Date.now() - startTime < timeout) {
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

        if (rng.nextf < extraPathDensity) {
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

    for (let x1 = rect.x; x1 < x2; x1++) {
        points.push({ x: x1, y: rect.y });
        points.push({ x: x1, y: y2 });
    }

    for (let y1 = rect.y; y1 < y2; y1++) {
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
    const aStar = new AStar(map);

    const paths: XY[][] = [];

    _generateMST(rooms, params).forEach((rects: RectPair) => {
        const { a, b } = _getShortestPathBetweenRects(rects.a, rects.b);
        paths.push(aStar.findPath(a, b, params.astarFindPathParams));
    });

    return paths;
}

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
        if (rng.nextf < chanceExists && (
            (map.get(doorPoint.x, doorPoint.y - 1) === map.defaultValue && map.get(doorPoint.x, doorPoint.y + 1) === map.defaultValue) ||
            (map.get(doorPoint.x - 1, doorPoint.y) === map.defaultValue && map.get(doorPoint.x + 1, doorPoint.y) === map.defaultValue)
        )) {
            doors.push(doorPoint);
        }
    });

    return doors;
}

export function GenerateWalls(map: Map2D): XY[] {
    const walls: XY[] = [];

    map.forEach((x: number, y: number, _v: number) => {
        DIRECTIONS_8_WAY.forEach((dir: XY) => {
            const nx = dir.x + x;
            const ny = dir.y + y;

            if (map.get(nx, ny) === map.defaultValue) {
                walls.push({ x: nx, y: ny });
            }
        });
    });

    return walls;
}
