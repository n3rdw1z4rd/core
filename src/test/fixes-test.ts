import { assert, type TestSuite } from './assert';
import { Color } from '../color';
import { Emitter } from '../emitter';
import { EventQueue } from '../event-queue';
import { GestureRecognizer } from '../input/gestures';
import { Map2D } from '../map2d';
import { Map3D } from '../map3d';
import { inverseLerp, nearlyEqual, smoothstep, wrap } from '../math';
import { getRedYellowGreenGradientHex } from '../misc';
import { Observable } from '../observable';
import { Rectangle } from '../rectangle';
import { Rng } from '../rng';
import { SpatialPartition2d } from '../spatial-partition-2d';
import { SpatialPartition3d } from '../spatial-partition-3d';
import { CreateStarfield } from '../three/starfield';
import { Vector } from '../vector';

// bugs found while writing the API docs
export const fixesTests: TestSuite = {
    'Color: constructor channels are 0-255, like the setters'() {
        assert.deepEqual(new Color(1, 0.5, 254.6, 255).rgba, [1, 1, 255, 255]);
    },

    'Color.fromHsv wraps negative hues'() {
        assert.deepEqual(Color.fromHsv(-0.5, 1, 1).rgba, Color.fromHsv(0.5, 1, 1).rgba);
        assert.deepEqual(Color.fromHsv(-1 / 3, 1, 1).rgba, [0, 0, 255, 255]);
    },

    'Rectangle: padding grows the rectangle for points and rectangles alike'() {
        const r = new Rectangle(0, 0, 10, 10);

        assert.ok(r.contains(new Vector(11, 5), 1));
        assert.ok(r.contains(new Rectangle(-1, -1, 12, 12), 1));
        assert.ok(!r.contains(new Rectangle(1, 1, 8, 8), -2));
        assert.ok(r.vectorInside(new Vector(-1, -1), 1));
    },

    'Rectangle.intersects: padding is the allowed gap'() {
        const a = new Rectangle(0, 0, 10, 10);

        assert.ok(a.intersects(new Rectangle(12, 0, 5, 5), 2));
        assert.ok(!a.intersects(new Rectangle(13, 0, 5, 5), 2));
    },

    'math: empty ranges'() {
        assert.equal(inverseLerp(2, 2, 5), 0);
        assert.equal(smoothstep(1, 1, 0.5), 0);
        assert.equal(smoothstep(1, 1, 1), 1);
        assert.equal(wrap(5, 3, 3), 3);
    },

    'nearlyEqual is relative for large values'() {
        assert.ok(nearlyEqual(0.1 + 0.2, 0.3));
        assert.ok(nearlyEqual(1e6 + 1e-10, 1e6));
        assert.ok(!nearlyEqual(1e6 + 1, 1e6));
    },

    'Vector.dividedBy is plain division'() {
        const v = new Vector(4, 0).dividedBy(0, 2);

        assert.equal(v.x, Infinity);
        assert.equal(v.y, 0);
    },

    'Rng.pick: undefined for an empty array'() {
        assert.equal(new Rng(1).pick([] as number[]), undefined);
    },

    'getRedYellowGreenGradientHex rates value / max'() {
        assert.equal(getRedYellowGreenGradientHex(0), '#ff0000');
        assert.equal(getRedYellowGreenGradientHex(0.5), '#ffff00');
        assert.equal(getRedYellowGreenGradientHex(1), '#00ff00');
        assert.equal(getRedYellowGreenGradientHex(25, 50), '#ffff00');
        assert.equal(getRedYellowGreenGradientHex(0.25, 0.5), '#ffff00');
        assert.equal(getRedYellowGreenGradientHex(5, 0), '#ff0000');
    },

    'Observable.once forwards notify arguments'() {
        const o = new Observable<number>();
        const calls: unknown[][] = [];

        o.once((...args) => calls.push(args));
        o.notify(1, 'a', 'b');
        o.notify(2);

        assert.deepEqual(calls, [[1, 'a', 'b']]);
    },

    'Emitter.off removes listeners'() {
        const e = new Emitter();
        const calls: string[] = [];
        const a = () => calls.push('a');
        const b = () => calls.push('b');

        e.on('x', a).on('x', b);
        e.off('x', a).emit('x');
        e.off('x').emit('x');

        assert.deepEqual(calls, ['b']);
    },

    'EventQueue.consume returns a copy'() {
        const q = new EventQueue<number>();

        q.emit(1);
        const events = q.consume();
        q.clear();

        assert.deepEqual(events, [1]);
    },

    'Map2D.forEachInArea includes both corners'() {
        const m = new Map2D();

        m.set(0, 0, 1);
        m.set(2, 2, 2);
        m.set(3, 3, 3);

        const seen: number[] = [];
        m.forEachInArea(0, 0, 2, 2, (_x, _y, n) => seen.push(n));

        assert.deepEqual(seen, [1, 2]);
    },

    'Map3D.get takes a default value'() {
        const m = new Map3D();

        assert.equal(m.get(0, 0, 0, 7), 7);
        assert.equal(m.get(0, 0, 0), m.defaultValue);
    },

    'spatial partitions: small grids return each neighbour cell once'() {
        const p2 = new SpatialPartition2d(0.5, []); // 2 x 2 cells
        const p3 = new SpatialPartition3d(0.5, []); // 2 x 2 x 2 cells

        assert.equal(p2.getCellNeighbors(0, 0).length, 4);
        assert.equal(p3.getCellNeighbors(0, 0, 0).length, 8);
        assert.equal(new SpatialPartition2d(0.1, []).getCellNeighbors(0, 0).length, 9);
    },

    'GestureRecognizer.clear drops pending gestures and the first tap'() {
        const g = new GestureRecognizer();

        g.down(1, 10, 10, 0);
        g.up(1, 10, 10, 50);
        g.clear();
        assert.deepEqual(g.update(60).gestures, []);

        g.down(1, 10, 10, 100);
        g.up(1, 10, 10, 150);
        assert.deepEqual(g.update(160).gestures, ['tap']); // not a double tap
    },

    'CreateStarfield: the same seed gives the same stars'() {
        const positions = (seed?: number) => [...CreateStarfield(10, 20, 0xffffff, seed).geometry.attributes.position.array];

        assert.deepEqual(positions(7), positions(7));
        assert.notDeepEqual(positions(7), positions(8));
    },
};
