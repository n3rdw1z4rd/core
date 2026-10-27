import { BoxGeometry, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { assert, type TestSuite } from './assert';
import { AdaptiveGrid } from '../three/adaptive-grid';
import { EditorCamera } from '../three/editor-camera';
import { pickEntity } from '../three/picking';
import { ComponentRegistry } from '../three/schema';
import { World } from '../three/world';

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `expected ${b}, got ${a}`);

function view(projection: 'orthographic' | 'perspective' = 'orthographic') {
    const v = new EditorCamera({ projection });
    v.resize(800, 600);
    v.zoom = 2;
    v.target.set(10, 20, 0);
    v.update();
    return v;
}

export const editorTests: TestSuite = {
    'EditorCamera: screen center is the target; +y is up on screen'() {
        for (const p of ['orthographic', 'perspective'] as const) {
            const v = view(p);
            const c = v.screenToWorld(400, 300)!;
            near(c.x, 10); near(c.y, 20);
            const above = v.screenToWorld(400, 300 - 100)!; // 100 px up
            near(above.y, 20 + 50, 1e-3); // zoom 2: 50 units
        }
    },

    'EditorCamera: worldToScreen inverts screenToWorld'() {
        for (const p of ['orthographic', 'perspective'] as const) {
            const v = view(p);
            const w = v.screenToWorld(123, 456)!;
            const s = v.worldToScreen(w);
            near(s.x, 123, 1e-3); near(s.y, 456, 1e-3);
        }
    },

    'EditorCamera: pan makes the world follow the pointer'() {
        const v = view();
        const before = v.screenToWorld(200, 200)!;
        v.pan(30, -40);
        const after = v.screenToWorld(230, 160)!;
        near(after.x, before.x); near(after.y, before.y);
    },

    'EditorCamera: zoomAt keeps the point under the cursor'() {
        for (const p of ['orthographic', 'perspective'] as const) {
            const v = view(p);
            const before = v.screenToWorld(100, 500)!;
            v.zoomAt(100, 500, 1.7);
            const after = v.screenToWorld(100, 500)!;
            near(after.x, before.x, 1e-3); near(after.y, before.y, 1e-3);
            near(v.zoom, 3.4);
        }
    },

    'EditorCamera: fit frames a box clear of the insets'() {
        const v = view();
        v.fit(0, 0, 100, 50, { l: 200, r: 0, t: 0, b: 100 }, 0);
        // uncovered area: x 200..800, y 0..500 → box center at (500, 250) on screen
        const s = v.worldToScreen(new Vector3(50, 25, 0));
        near(s.x, 500, 1e-3); near(s.y, 250, 1e-3);
        near(v.zoom, 2); // min(600/100, 500/50) = 6, capped at maxZoom 2
    },

    'EditorCamera: orbit = false locks a 2D view'() {
        const v = view();
        v.orbit = false;
        v.rotate(100, 100);
        assert.equal(v.yaw, 0); assert.equal(v.pitch, 0);
        v.orbit = true;
        v.rotate(0, 1e6);
        assert.ok(v.pitch < Math.PI / 2);
    },

    'AdaptiveGrid: lines are never closer than minSpacingPx'() {
        const grid = new AdaptiveGrid({ origin: false, minSpacingPx: 8 });
        const maxSegments = (800 / 8 + 2) + (600 / 8 + 2);
        for (const zoom of [4, 1, 0.2, 0.05, 0.011]) {
            const v = view();
            v.zoom = zoom;
            v.update();
            grid.update(v, 32);
            const segments = grid.geometry.drawRange.count / 2;
            assert.ok(segments > 0 && segments <= maxSegments, `zoom ${zoom}: ${segments} segments`);
        }
    },

    'pickEntity: walks up to the entity; nearest first; slop catches near misses'() {
        const world = new World({ registry: new ComponentRegistry() });
        const back = world.create('back');
        back.add(new Mesh(new BoxGeometry(10, 10, 1), new MeshBasicMaterial()));
        const front = world.create('front');
        front.position.set(0, 0, 1);
        front.add(new Mesh(new BoxGeometry(2, 2, 1), new MeshBasicMaterial()));
        const v = new EditorCamera();
        v.resize(100, 100);
        v.zoom = 1;
        v.update();

        assert.equal(pickEntity(world, v, 50, 50)?.entity.name, 'front');
        assert.equal(pickEntity(world, v, 53, 50)?.entity.name, 'back');
        assert.equal(pickEntity(world, v, 58, 50), null);
        assert.equal(pickEntity(world, v, 58, 50, { slopPx: 4 })?.entity.name, 'back');
        front.visible = false;
        assert.equal(pickEntity(world, v, 50, 50)?.entity.name, 'back');
        assert.equal(pickEntity(world, v, 50, 50, { filter: (o) => o.parent !== back })?.entity.name ?? null, null);
    },
};
