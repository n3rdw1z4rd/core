import { AStar, AStarPoint } from "../astar";
import { log } from "../log";
import { Map2D } from "../map2d";
import { rng } from "../rng";

log('astar test');

const SEED = 42;
const WIDTH = 48;
const HEIGHT = 24;
const DENSITY = 0.2;

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

function _generateWalls(): Map2D {
    log('generating walls');

    const map = new Map2D(0);

    let iterations = 0 | (WIDTH * HEIGHT) * DENSITY;
    log('iterations:', iterations);

    while (iterations--) {
        const x = rng.range(WIDTH);
        const y = rng.range(HEIGHT);

        map.set(x, y, 1);

        if (rng.nextf < 0.5) {
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

function _drawMap(map: Map2D) {
    for (let y = 0; y < HEIGHT; y++) {
        const row: string[] = [];

        for (let x = 0; x < WIDTH; x++) {
            const mapValue = map.get(x, y);
            const { glyph, color } = TILES[mapValue];

            row.push(`\x1b[${color}m${glyph}\x1b[0m`);
        }

        console.log(row.join(''));
    }
}

export function aStarTest() {
    log('SEED:', SEED);
    log('WIDTH:', WIDTH);
    log('HEIGHT:', HEIGHT);
    log('DENSITY:', DENSITY);

    rng.seed = SEED;

    const map = _generateWalls();

    const start: AStarPoint = {
        x: rng.range(WIDTH),
        y: rng.range(HEIGHT),
    };

    const end: AStarPoint = {
        x: rng.range(WIDTH),
        y: rng.range(HEIGHT),
    };

    log('start:', start);
    log('end:', end);

    map.set(start.x, start.y, 3);
    map.set(end.x, end.y, 4);

    const aStar = new AStar(map);

    aStar.findPath(start, end).forEach((p: AStarPoint) => {
        map.set(p.x, p.y, 2);
    });

    _drawMap(map);
}
