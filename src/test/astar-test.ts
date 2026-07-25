import { AStar, AStarPoint } from "../astar";
import { Map2D } from "../map2d";
import { rng } from "../rng";
import log from '../logger';

const DEFAULT_SEED = 42;
const DEFAULT_WIDTH = 80;
const DEFAULT_HEIGHT = 24;
const DEFAULT_DENSITY = 0.2;

const COLOR = {
    Black: 30,
    Red: 31,
    Green: 32,
    Yellow: 33,
    Blue: 34,
    Magenta: 35,
    Cyan: 36,
    White: 37,
};

const TILES = [
    { glyph: String.fromCharCode(183), color: COLOR.Blue },
    { glyph: '#', color: COLOR.Cyan },
    { glyph: String.fromCharCode(215), color: COLOR.Magenta },
    { glyph: '?', color: COLOR.Yellow },
    { glyph: '!', color: COLOR.Yellow },
];

function _generateWalls(width: number, height: number, density: number): Map2D {
    log('generating walls');

    const map = new Map2D(0);

    let iterations = 0 | (width * height) * density;
    log('iterations:', iterations);

    while (iterations--) {
        const x = rng.range(width);
        const y = rng.range(height);

        map.set(x, y, 1);

        if (rng.nextFloat() < 0.5) {
            const directions = rng.shuffle([
                [-1, 0],
                [0, -1],
                [1, 0],
                [0, 1]
            ]);

            for (const offset of directions) {
                const [ox, oy] = offset;
                const nx = x + ox;
                const ny = y + oy;

                if (!map.get(nx, ny)) {
                    map.set(nx, ny, 1);
                    break;
                }
            }
        }
    }

    return map;
}

function _drawMap(map: Map2D, width: number, height: number) {
    for (let y = 0; y < height; y++) {
        const row: string[] = [];

        for (let x = 0; x < width; x++) {
            const mapValue = map.get(x, y);
            const { glyph, color } = TILES[mapValue];

            row.push(`\x1b[${color}m${glyph}\x1b[0m`);
        }

        console.log(row.join(''));
    }
}

export function aStarTest(
    seed: number = DEFAULT_SEED,
    width: number = DEFAULT_WIDTH,
    height: number = DEFAULT_HEIGHT,
    density: number = DEFAULT_DENSITY,
) {
    log('*** astar test ***');
    log('seed:', seed);
    log('width:', width);
    log('height:', height);
    log('density:', density);

    rng.seed = seed;

    const map = _generateWalls(width, height, density);

    const start: AStarPoint = {
        x: rng.range(width),
        y: rng.range(height),
    };

    const end: AStarPoint = {
        x: rng.range(width),
        y: rng.range(height),
    };

    log('start:', start);
    log('end:', end);

    map.set(start.x, start.y, 3);
    map.set(end.x, end.y, 4);

    const aStar = new AStar(map);

    aStar.findPath(start, end).forEach((p: AStarPoint) => {
        map.set(p.x, p.y, 2);
    });

    _drawMap(map, width, height);
}
