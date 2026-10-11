import { AStar } from '../astar';
import { Clock } from '../clock';
import { Color } from '../color';
import { ECS } from '../ecs';
import { Texture } from 'three';
import { CubeSphereGeometry } from '../three/cube-sphere-geometry';
import { TextureAtlas } from '../three/texture-atlas';
import { MAP_2D_MAX_COORD, MAP_2D_MIN_COORD, Map2D } from '../map2d';
import { MAP_3D_MAX_COORD, MAP_3D_MIN_COORD, Map3D } from '../map3d';
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

    'CubeSphereGeometry: shared edge vertices (no seams), outward winding, on the sphere'() {
        const segments = 8;
        const g = new CubeSphereGeometry(10, segments);
        const p = g.attributes.position.array;
        const index = g.index!.array;

        const keys = new Set<string>();
        for (let i = 0; i < p.length; i += 3) {
            keys.add(`${p[i].toFixed(5)},${p[i + 1].toFixed(5)},${p[i + 2].toFixed(5)}`);
            assert.ok(Math.abs(Math.hypot(p[i], p[i + 1], p[i + 2]) - 5) < 1e-4);
        }

        assert.equal(p.length / 3, 6 * (segments + 1) ** 2 - 12 * (segments + 1) + 8);
        assert.equal(keys.size, p.length / 3);

        for (let t = 0; t < index.length; t += 3) {
            const [a, b, c] = [index[t], index[t + 1], index[t + 2]].map(k => [p[3 * k], p[3 * k + 1], p[3 * k + 2]]);
            const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
            const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
            const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];

            assert.ok(n[0] * a[0] + n[1] * a[1] + n[2] * a[2] > 0, 'triangle faces inward');
        }
    },

    'TextureAtlas: tile UVs with offset and spacing, v = 0 at the tile bottom'() {
        // 64x32 sheet: 2px left/top margin, 12px tiles with 4px gaps -> 4 columns, 2 rows
        const atlas = new TextureAtlas({ width: 64, height: 32, texture: new Texture() }, { tileWidth: 12, offsetX: 2, offsetY: 2, spacing: 4 });

        assert.equal(atlas.columns, 4);
        assert.equal(atlas.rows, 2);

        const px = ([u, v]: number[]) => [u * 64, (1 - v) * 32]; // back to pixels from the top-left

        assert.deepEqual(px(atlas.getUV(0, 0, 1)), [2, 2]);    // tile 0 top-left
        assert.deepEqual(px(atlas.getUV(0, 1, 0)), [14, 14]);  // tile 0 bottom-right
        assert.deepEqual(px(atlas.getUV(1, 0, 1)), [18, 2]);   // spacing skipped
        assert.deepEqual(px(atlas.getUV(5, 0, 0)), [18, 30]);  // second row, bottom-left
    },

    'Map2D / Map3D: warn once when a coordinate is outside the supported range'() {
        const warn = console.warn;
        const warnings: unknown[] = [];
        console.warn = (...args: unknown[]) => { warnings.push(args); };

        try {
            const map = new Map3D(0);

            map.set(MAP_3D_MAX_COORD, MAP_3D_MIN_COORD, 0, 1); // edges are fine
            assert.equal(warnings.length, 0);

            map.set(MAP_3D_MAX_COORD + 1, 0, 0, 2);
            map.get(0, 0, MAP_3D_MIN_COORD - 1);
            assert.equal(warnings.length, 1);

            const map2 = new Map2D(0);

            map2.set(MAP_2D_MAX_COORD, MAP_2D_MIN_COORD, 1); // edges are fine
            assert.equal(warnings.length, 1);

            map2.set(MAP_2D_MAX_COORD + 1, 0, 2);
            map2.get(0, MAP_2D_MIN_COORD - 1);
            assert.equal(warnings.length, 2);
        } finally {
            console.warn = warn;
        }
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
