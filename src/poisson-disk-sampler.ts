import { rng } from './rng';

interface Vec2 {
    x: number;
    y: number;
}

export function PoissonDiskSampler(
    width: number,
    height: number,
    minDist: number,
    maxPoints: number = 30,
): Vec2[] {
    const k = maxPoints;
    const cellSize = minDist / Math.SQRT2;
    const gridWidth = Math.ceil(width / cellSize);
    const gridHeight = Math.ceil(height / cellSize);
    const grid: (Vec2 | null)[][] = Array.from({ length: gridWidth }, () =>
        Array(gridHeight).fill(null)
    );

    const samples: Vec2[] = [];
    const active: Vec2[] = [];

    function gridIndex(p: Vec2) {
        return {
            i: Math.floor(p.x / cellSize),
            j: Math.floor(p.y / cellSize)
        };
    }

    function isFarEnough(p: Vec2): boolean {
        const { i, j } = gridIndex(p);
        for (let x = i - 2; x <= i + 2; x++) {
            for (let y = j - 2; y <= j + 2; y++) {
                if (x < 0 || y < 0 || x >= gridWidth || y >= gridHeight) continue;
                const neighbor = grid[x][y];
                if (!neighbor) continue;
                const dx = neighbor.x - p.x;
                const dy = neighbor.y - p.y;
                if (dx * dx + dy * dy < minDist * minDist) {
                    return false;
                }
            }
        }
        return true;
    }

    const initial: Vec2 = {
        x: rng.range(0, width),
        y: rng.range(0, height)
    };
    const { i: i0, j: j0 } = gridIndex(initial);
    grid[i0][j0] = initial;
    samples.push(initial);
    active.push(initial);

    while (active.length) {
        const index = Math.floor(rng.range(0, active.length));
        const point = active[index];

        let found = false;
        for (let n = 0; n < k; n++) {
            const angle = rng.range(0, Math.PI * 2);
            const dist = rng.range(minDist, 2 * minDist);
            const newPoint: Vec2 = {
                x: point.x + Math.cos(angle) * dist,
                y: point.y + Math.sin(angle) * dist
            };

            if (
                newPoint.x >= 0 &&
                newPoint.y >= 0 &&
                newPoint.x < width &&
                newPoint.y < height &&
                isFarEnough(newPoint)
            ) {
                const { i, j } = gridIndex(newPoint);
                grid[i][j] = newPoint;
                samples.push(newPoint);
                active.push(newPoint);
                found = true;
                break;
            }
        }

        if (!found) {
            active.splice(index, 1);
        }
    }

    return samples;
}
