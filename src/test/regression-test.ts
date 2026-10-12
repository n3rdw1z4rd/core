import { assert, type TestSuite } from './assert';
import { findPath } from '../astar';
import { Clock } from '../clock';
import { Color } from '../color';
import { ECS } from '../ecs';
import { BoxGeometry, type Material, Mesh, MeshBasicMaterial, Object3D, Scene, Texture, Vector3 } from 'three';
import { Random } from '../random';
import { buildVoxelGeometry } from '../three/voxel-geometry';
import { VoxelMesh } from '../three/voxel-mesh';
import { radians } from '../math';
import { CameraRig } from '../three/camera-rig';
import { CubeSphereGeometry } from '../three/cube-sphere-geometry';
import { TextureAtlas } from '../three/texture-atlas';
import { MAP_2D_MAX_COORD, MAP_2D_MIN_COORD, Map2D } from '../map2d';
import { MAP_3D_MAX_COORD, MAP_3D_MIN_COORD, Map3D } from '../map3d';
import { k2xyz, xyz2k } from '../misc';
import { ParticleSystem2d } from '../particle-system-2d';
import { Rng } from '../rng';
import { SpatialPartition2d } from '../spatial-partition-2d';
import { SpatialPartition3d } from '../spatial-partition-3d';

export const regressionTests: TestSuite = {
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

    'findPath: 4-way shortest path; adjacent stops next to a blocked goal'() {
        const map = new Map2D(0);
        const cost = (x: number, y: number) => map.get(x, y) === 0 ? 1 : Infinity;

        // wall with a single gap at y = 5
        for (let y = -10; y <= 10; y++) if (y !== 5) map.set(5, y, 1);

        const path = findPath({ x: 0, y: 0 }, { x: 10, y: 0 }, cost);

        assert.ok(path.every(p => map.get(p.x, p.y) === 0));
        assert.ok(path.some(p => p.x === 5 && p.y === 5));
        assert.deepEqual(path[path.length - 1], { x: 10, y: 0 });
        assert.equal(path.length, 20); // (0,0) -> (5,5) -> (10,0): 5+5 + 5+5 steps

        map.set(10, 0, 1); // goal is now blocked, e.g. occupied by the player

        assert.deepEqual(findPath({ x: 0, y: 0 }, { x: 10, y: 0 }, cost), []);

        const adjacent = findPath({ x: 0, y: 0 }, { x: 10, y: 0 }, cost, { adjacent: true });
        const last = adjacent[adjacent.length - 1];
        assert.equal(adjacent.length, 19);
        assert.equal(Math.abs(last.x - 10) + Math.abs(last.y), 1);
    },

    'findPath: diagonal steps, no corner cutting by default, step costs'() {
        const open = () => 1;

        const straight = findPath({ x: 0, y: 0 }, { x: 5, y: 5 }, open, { diagonal: true });
        assert.equal(straight.length, 5);
        assert.ok(straight.every((p, i) => p.x === i + 1 && p.y === i + 1));

        // single blocked tile at (1, 0): the diagonal (0,0) -> (1,1) would clip its corner
        const wall = (x: number, y: number) => (x === 1 && y === 0) ? Infinity : 1;

        assert.equal(findPath({ x: 0, y: 0 }, { x: 1, y: 1 }, wall, { diagonal: true }).length, 2);
        assert.equal(findPath({ x: 0, y: 0 }, { x: 1, y: 1 }, wall, { diagonal: true, cutCorners: true }).length, 1);

        // a band of expensive tiles at x = 2 (cost 10, 3 tall) is worth walking around
        const swamp = (x: number, y: number) => (x === 2 && Math.abs(y) <= 1) ? 10 : 1;
        const around = findPath({ x: 0, y: 0 }, { x: 4, y: 0 }, swamp);

        assert.ok(around.every(p => swamp(p.x, p.y) === 1));
    },

    'findPath: unreachable goal, partial path, maxNodes, deterministic'() {
        const map = new Map2D(0);
        const cost = (x: number, y: number) => map.get(x, y) === 0 ? 1 : Infinity;

        // the goal is boxed in
        for (let x = 9; x <= 11; x++) for (let y = -1; y <= 1; y++) if (x !== 10 || y !== 0) map.set(x, y, 1);

        assert.deepEqual(findPath({ x: 0, y: 0 }, { x: 10, y: 0 }, cost, { maxNodes: 2000 }), []);

        const partial = findPath({ x: 0, y: 0 }, { x: 10, y: 0 }, cost, { maxNodes: 2000, partial: true });
        assert.deepEqual(partial[partial.length - 1], { x: 8, y: 0 }); // as close as it can get

        // budget too small to arrive: still heads towards the goal
        const budget = findPath({ x: 0, y: 0 }, { x: 100, y: 0 }, () => 1, { maxNodes: 10, partial: true });
        assert.ok(budget.length > 0 && budget[budget.length - 1].x > 0);

        const a = findPath({ x: 0, y: 0 }, { x: 7, y: 9 }, () => 1, { diagonal: true });
        const b = findPath({ x: 0, y: 0 }, { x: 7, y: 9 }, () => 1, { diagonal: true });
        assert.deepEqual(a, b);
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

    'CameraRig: follows the target, orbits, zooms into first person'() {
        const scene = new Scene();
        const player = new Object3D();
        const rig = new CameraRig({ target: player, distance: 5 });

        scene.add(player, rig);
        rig.zoomDamping = 0; // no easing, so each update lands exactly

        const cameraWorld = () => { scene.updateMatrixWorld(true); return rig.camera.getWorldPosition(new Vector3()); };
        const near = (a: Vector3, b: Vector3) => a.distanceTo(b) < 1e-6;

        player.position.set(10, 0, -3);
        rig.update(1 / 60);

        // yaw 0, pitch 0: camera 5 units behind (+z) the eye position
        assert.ok(near(cameraWorld(), new Vector3(10, 1.6, 2)));

        rig.yaw = Math.PI / 2; // turned left: behind is now +x
        rig.update(1 / 60);
        assert.ok(near(cameraWorld(), new Vector3(15, 1.6, -3)));

        rig.pitch = -10; // way past the limit
        rig.update(1 / 60);
        assert.ok(Math.abs(rig.pitch - radians(-80)) < 1e-9);

        const modes: boolean[] = [];
        rig.onModeChange = (fp) => modes.push(fp);

        for (let i = 0; i < 50; i++) rig.dolly(-500);
        rig.update(1 / 60);

        assert.equal(rig.distance, 0);
        assert.ok(rig.isFirstPerson);
        assert.ok(!player.visible);
        assert.ok(near(cameraWorld(), new Vector3(10, 1.6, -3))); // at the eyes
        assert.ok(Math.abs(rig.pitch - radians(-80)) < 1e-9);  // still within the wider first-person limits

        rig.orbit(0, -10000); // pointer moved up: look all the way up
        assert.ok(Math.abs(rig.pitch - radians(89)) < 1e-9);

        rig.dolly(100); // out of first person
        rig.update(1 / 60);

        assert.equal(rig.distance, 0.5);
        assert.ok(!rig.isFirstPerson);
        assert.ok(player.visible);
        assert.ok(Math.abs(rig.pitch - radians(30)) < 1e-9); // back to third-person limits
        assert.deepEqual(modes, [true, false]);
    },

    'CameraRig: pulls in in front of walls, eases back out'() {
        const scene = new Scene();
        const player = new Object3D();
        const rig = new CameraRig({ target: player, distance: 5 });
        const wall = new Mesh(new BoxGeometry(10, 10, 0.2), new MeshBasicMaterial());

        wall.position.set(0, 0, 3); // between the eyes and the camera (which wants z = 5)
        scene.add(player, rig, wall);
        scene.updateMatrixWorld(true);

        rig.collisionObjects = [wall];
        rig.update(1 / 60);

        // wall face at z = 2.9, minus 0.2 padding
        assert.ok(Math.abs(rig.cameraDistance - 2.7) < 1e-6, `camera distance ${rig.cameraDistance}`);

        scene.remove(wall);
        rig.collisionObjects = [];
        rig.update(1 / 60);

        assert.ok(rig.cameraDistance > 2.7 && rig.cameraDistance < 5); // easing back out, not jumping

        for (let i = 0; i < 120; i++) rig.update(1 / 60);
        assert.equal(rig.cameraDistance, 5);
    },

    'buildVoxelGeometry: culling, greedy merging, winding and coverage'() {
        // a random 8x8x8 blob, two colors
        const blob = new Map3D();
        for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) for (let z = 0; z < 8; z++) {
            if (Random.float(5, x, y, z) < 0.5) blob.set(x, y, z, Random.float(6, x, y, z) < 0.5 ? 0 : 1);
        }

        let visible = 0;
        blob.forEach((x, y, z) => {
            for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
                if (blob.get(x + dx, y + dy, z + dz) === blob.defaultValue) visible++;
            }
        });

        for (const options of [{ greedy: false }, { greedy: true }, { greedy: true, ambientOcclusion: false }]) {
            const g = buildVoxelGeometry(blob, options);
            const pos = g.attributes.position.array;
            const nrm = g.attributes.normal.array;
            const idx = g.index!.array;
            let area = 0;

            for (let t = 0; t < idx.length; t += 3) {
                const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]].map(i => new Vector3(pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]));
                const cross = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a));
                const normal = new Vector3(nrm[3 * idx[t]], nrm[3 * idx[t] + 1], nrm[3 * idx[t] + 2]);

                assert.ok(cross.dot(normal) > 0, 'triangle wound against its normal');
                area += cross.length() / 2;
            }

            assert.ok(Math.abs(area - visible) < 1e-6, `area ${area} vs ${visible} visible faces`);

            if (!options.greedy) assert.equal(idx.length / 6, visible);
            else assert.ok(idx.length / 6 < visible);
        }

        // a solid 16^3 one-color cube merges to 6 quads (AO is uniform on a flat convex face)
        const cube = new Map3D();
        for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) for (let z = 0; z < 16; z++) cube.set(x, y, z, 0);
        assert.equal(buildVoxelGeometry(cube).index!.count / 6, 6);
    },

    'buildVoxelGeometry: neighbor lookup, ambient occlusion, colors'() {
        const one = new Map3D();
        one.set(0, 0, 0, 0);

        assert.equal(buildVoxelGeometry(one).index!.count / 6, 6);

        // a neighbouring chunk's voxel at x = 1 hides the +x face
        assert.equal(buildVoxelGeometry(one, { neighbor: (x, y, z) => (x === 1 && y === 0 && z === 0) ? 5 : -1 }).index!.count / 6, 5);
        assert.equal(buildVoxelGeometry(one, { includeHiddenFaces: true, neighbor: () => 5 }).index!.count / 6, 6);

        // floor tile with a wall voxel above-and-beside it: the floor's top face is darkened along that edge
        const crease = new Map3D();
        crease.set(0, 0, 0, 0);
        crease.set(1, 1, 0, 0);

        const lit = (g: ReturnType<typeof buildVoxelGeometry>) => {
            const out: number[] = [];
            const pos = g.attributes.position.array, nrm = g.attributes.normal.array, col = g.attributes.color.array;
            for (let i = 0; i < pos.length / 3; i++) {
                // top face (+y) of the floor voxel, at y = 1 and x in [0, 1]
                if (nrm[3 * i + 1] === 1 && pos[3 * i + 1] === 1 && pos[3 * i] <= 1) out.push(col[3 * i]);
            }
            return out;
        };

        const shaded = lit(buildVoxelGeometry(crease, { palette: [0xffffff] }));
        assert.equal(shaded.length, 4);
        assert.ok(Math.min(...shaded) < Math.max(...shaded), 'expected darker corners next to the wall');
        assert.ok(lit(buildVoxelGeometry(crease, { palette: [0xffffff], ambientOcclusion: false })).every(c => c === 1));

        // palette, stable non-black fallback, explicit missing color
        const colorOf = (map: Map3D, options = {}) => {
            const c = buildVoxelGeometry(map, { ambientOcclusion: false, ...options }).attributes.color.array;
            return [c[0], c[1], c[2]];
        };

        assert.deepEqual(colorOf(one, { palette: [0xff0000] }), [1, 0, 0]);
        assert.deepEqual(colorOf(one), colorOf(one));
        assert.ok(colorOf(one).some(c => c > 0));
        assert.deepEqual(colorOf(one, { missingColor: 0x0000ff }), [0, 0, 1]);
    },

    'VoxelMesh: bounds, dirty tracking, rebuild'() {
        const mesh = new VoxelMesh({ bounds: { width: 4, height: 4, depth: 4 }, palette: [0xffffff] });

        assert.ok((mesh.material as Material).vertexColors);
        assert.ok(!mesh.update());

        mesh.set(0, 0, 0, 0);
        mesh.set(9, 0, 0, 0); // outside the bounds: ignored
        assert.equal(mesh.voxels.size, 1);
        assert.ok(mesh.needsUpdate);
        assert.ok(mesh.update());
        assert.equal(mesh.geometry.index!.count / 6, 6);

        mesh.set(0, 0, 0, 0); // same value: no change
        assert.ok(!mesh.needsUpdate);

        mesh.clearVoxels();
        assert.ok(mesh.update());
        assert.equal(mesh.geometry.index!.count, 0);
    },

    'Clock.tick: zero first delta, capped delta, elapsed time, fps'() {
        const clock = new Clock();

        assert.equal(clock.tick(5000), 0);
        assert.equal(clock.tick(5016), 0.016);
        assert.equal(clock.deltaTime, 0.016);

        assert.equal(clock.tick(35016), 0.1); // 30s stall (hidden tab) is capped
        assert.ok(Math.abs(clock.elapsedTime - 0.116) < 1e-9);

        clock.maxDeltaTime = Infinity;
        assert.equal(clock.tick(36016), 1);

        const fpsClock = new Clock();
        for (let i = 0; i <= 60; i++) fpsClock.tick(i * 1000 / 60); // one second at 60fps
        assert.equal(fpsClock.fps, 60);
        for (let i = 61; i <= 120; i++) fpsClock.tick(i * 1000 / 60); // and another
        assert.equal(fpsClock.fps, 60);
    },

    'Clock.start / stop: drives the callback from requestAnimationFrame'() {
        const g = globalThis as any;
        const raf = g.requestAnimationFrame;
        const caf = g.cancelAnimationFrame;

        let pending: ((time: number) => void) | undefined;
        g.requestAnimationFrame = (cb: (time: number) => void) => { pending = cb; return 1; };
        g.cancelAnimationFrame = () => { pending = undefined; };

        const runFrame = (time: number) => { const cb = pending; pending = undefined; cb?.(time); };

        try {
            const clock = new Clock();
            const calls: number[][] = [];

            clock.start((dt, elapsed) => calls.push([dt, elapsed]));
            assert.ok(clock.isRunning);

            runFrame(1000);
            runFrame(1020);
            runFrame(1040);
            assert.deepEqual(calls, [[0, 0], [0.02, 0.02], [0.02, 0.04]]);

            clock.start((dt) => calls.push([dt, -1])); // while running: swaps the callback, no second loop
            runFrame(1060);
            assert.deepEqual(calls[3], [0.02, -1]);

            clock.stop();
            assert.ok(!clock.isRunning);
            assert.equal(pending, undefined);

            clock.start((dt, elapsed) => calls.push([dt, elapsed])); // restart resets timing
            runFrame(9000);
            assert.deepEqual(calls[4], [0, 0]);
        } finally {
            g.requestAnimationFrame = raf;
            g.cancelAnimationFrame = caf;
        }
    },
};
