import { AStar } from '../astar';
import { Clock } from '../clock';
import { Color } from '../color';
import { ECS } from '../ecs';
import { Map2D } from '../map2d';
import { k2xyz, xyz2k } from '../misc';
import { ParticleSystem2d } from '../particle-system-2d';
import { Rng } from '../rng';
import { SpatialPartition2d } from '../spatial-partition-2d';
import { SpatialPartition3d } from '../spatial-partition-3d';

// minimal assertions so the tests don't need @types/node (this is a browser library)
const assert = {
    ok(value: unknown, message = 'expected a truthy value'): void {
        if (!value) throw new Error(message);
    },
    equal(actual: unknown, expected: unknown): void {
        if (!Object.is(actual, expected)) throw new Error(`expected ${String(expected)}, got ${String(actual)}`);
    },
    deepEqual(actual: unknown, expected: unknown): void {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    notDeepEqual(actual: unknown, expected: unknown): void {
        if (JSON.stringify(actual) === JSON.stringify(expected)) throw new Error(`expected values to differ: ${JSON.stringify(actual)}`);
    },
};

declare const process: { exitCode?: number, argv: string[] };

const tests: Record<string, () => void> = {
    'Rng.pick can return the last element'() {
        const r = new Rng(1);
        const seen = new Set<number>();

        for (let i = 0; i < 1000; i++) seen.add(r.pick([0, 1, 2]));

        assert.deepEqual([...seen].sort(), [0, 1, 2]);
    },

    'Rng.shuffle can leave elements in place (Fisher-Yates, not Sattolo)'() {
        const r = new Rng(2);
        let fixedPoints = 0;

        for (let i = 0; i < 200; i++) {
            const shuffled = r.shuffle([0, 1, 2, 3]);
            fixedPoints += shuffled.filter((v, j) => v === j).length;
            assert.deepEqual([...shuffled].sort(), [0, 1, 2, 3]);
        }

        assert.ok(fixedPoints > 0);
    },

    'Rng.range returns integers in [min, max)'() {
        const r = new Rng(3);

        for (let i = 0; i < 1000; i++) {
            const n = r.range(-3, 4);
            assert.ok(Number.isInteger(n) && n >= -3 && n < 4, `range(-3, 4) returned ${n}`);

            const m = r.range(0.5, 2.5); // rounds up to [1, 3)
            assert.ok(m === 1 || m === 2, `range(0.5, 2.5) returned ${m}`);
        }
    },

    'xyz2k / k2xyz round-trip'() {
        assert.equal(xyz2k(1, -2, 3), '1,-2,3');
        assert.deepEqual(k2xyz(xyz2k(1, -2, 3)), [1, -2, 3]);
        assert.deepEqual(k2xyz(xyz2k(4, 5, 6, '|'), '|'), [4, 5, 6]);
    },

    'Color: hex parsing and channel rounding'() {
        assert.deepEqual(new Color('#ff8000').rgba, [255, 128, 0, 255]);
        assert.deepEqual(new Color('#f80').rgba, [255, 136, 0, 255]);
        assert.deepEqual(new Color('#ff800080').rgba, [255, 128, 0, 128]);

        const c = new Color();
        c.r = 127.6;
        assert.equal(c.r, 128);
        assert.equal(c.hexStr, '#80ffffff');

        c.hexStr = '#000';
        assert.equal(c.hexStr, '#000000ff');
    },

    'AStar: finds a shortest path that ends next to the target'() {
        const map = new Map2D(0);

        // wall with a single gap at y = 5
        for (let y = -10; y <= 10; y++) if (y !== 5) map.set(5, y, 1);

        const path = new AStar(map).findPath({ x: 0, y: 0 }, { x: 10, y: 0 });

        assert.ok(path.length > 0);
        assert.ok(path.every(p => map.get(p.x, p.y) === 0));
        assert.ok(path.some(p => p.x === 5 && p.y === 5));

        const last = path[path.length - 1];
        assert.equal(Math.abs(last.x - 10) + Math.abs(last.y), 1);
        assert.equal(path.length, 19); // (0,0) -> (5,5) -> (9,0): 5+5 + 4+5 steps
    },

    'AStar: returns [] when the target is unreachable'() {
        const map = new Map2D(0);

        for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) if (x || y) map.set(x, y, 1);

        assert.deepEqual(new AStar(map).findPath({ x: 0, y: 0 }, { x: 10, y: 10 }), []);
    },

    'ECS: instances have independent entity ids'() {
        const a = new ECS();
        const b = new ECS();

        a.createEntity();
        a.createEntity();
        b.clear();

        assert.equal(a.createEntity(), 2);
        assert.equal(b.createEntity(), 0);
    },

    'SpatialPartition: coordinates on the upper edge do not index past the grid'() {
        const p2 = new SpatialPartition2d(0.1, [{ x: 1, y: 1 }, { x: 0.999999, y: 0 }]);
        assert.ok(Array.isArray(p2.getCell(1, 1)));

        const p3 = new SpatialPartition3d(0.2, [{ x: 1, y: 1, z: 1 }]);
        assert.ok(Array.isArray(p3.getCell(1, 1, 1)));
    },

    'ParticleSystem2d: same seed gives the same, uncorrelated starting state'() {
        const a = new ParticleSystem2d(42) as any;
        const b = new ParticleSystem2d(42) as any;
        const c = new ParticleSystem2d(43) as any;

        assert.deepEqual(a._particles, b._particles);
        assert.deepEqual(a._attractionMatrix, b._attractionMatrix);
        assert.notDeepEqual(a._particles, c._particles);

        // particle i's y must not equal particle i+1's x
        assert.ok(a._particles.slice(0, -1).every((p: any, i: number) => p.y !== a._particles[i + 1].x));
    },

    'Clock: first frame has zero delta time'() {
        const clock = new Clock();

        assert.equal(clock.update(5000), 0);
        assert.equal(clock.update(5016), 0.016);
    },
};

export function regressionTest() {
    let failed = 0;

    for (const [name, test] of Object.entries(tests)) {
        try {
            test();
            console.log(`  ok   ${name}`);
        } catch (error) {
            failed++;
            console.log(`  FAIL ${name}`);
            console.log(error);
        }
    }

    console.log(`${Object.keys(tests).length - failed} passed, ${failed} failed`);

    if (failed) process.exitCode = 1;
}
