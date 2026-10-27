import { MathUtils, OrthographicCamera, PerspectiveCamera, Plane, Raycaster, Vector2, Vector3, type Camera } from 'three';

/** Screen edges covered by UI, CSS px. */
export interface ViewInsets {
    l: number;
    r: number;
    t: number;
    b: number;
}

/**
 * An editor viewport camera: orthographic or perspective, with pan, zoom-at-cursor, orbit
 * and fit-to-bounds, and conversions between screen (CSS px, relative to the canvas) and
 * world coordinates.
 *
 * Both projections share one rig — a `target` the camera looks at, `yaw`/`pitch` around it,
 * and a `zoom` in screen px per world unit at the target — so switching projection keeps the
 * framing. `yaw = pitch = 0` looks down -Z at the XY plane: a 2D view (three.js convention,
 * +Y up). Set `orbit = false` to lock it there.
 *
 * ```ts
 * const view = new EditorCamera();
 * view.resize(canvas.clientWidth, canvas.clientHeight);
 * view.pan(dx, dy);                    // the world follows the pointer
 * view.zoomAt(x, y, 1.1);              // the point under the cursor stays put
 * renderer.render(scene, view.camera); // the active three.js camera (updated by the calls above)
 * ```
 *
 * @category Three.js
 */
export class EditorCamera {
    readonly ortho: OrthographicCamera;
    readonly perspective: PerspectiveCamera;

    /** the point looked at (and orbited around) */
    readonly target = new Vector3();
    /** radians around +Y */
    yaw = 0;
    /** radians; positive looks down from above */
    pitch = 0;
    /** screen px per world unit, at the target */
    zoom = 1;
    minZoom = 0.01;
    maxZoom = 100;
    /** false locks yaw/pitch at 0 (a 2D view) */
    orbit = true;
    /** pitch limit, radians */
    maxPitch = Math.PI / 2 - 0.01;

    /** view size, CSS px */
    width = 1;
    height = 1;

    private _projection: 'orthographic' | 'perspective' = 'orthographic';
    private readonly raycaster = new Raycaster();
    private readonly ndc = new Vector2();
    private readonly plane = new Plane();

    constructor(options: { projection?: 'orthographic' | 'perspective'; fov?: number; orbit?: boolean } = {}) {
        this.ortho = new OrthographicCamera(-1, 1, 1, -1, 0.1, 1e6);
        this.perspective = new PerspectiveCamera(options.fov ?? 50, 1, 0.1, 1e6);
        this._projection = options.projection ?? 'orthographic';
        if (options.orbit !== undefined) this.orbit = options.orbit;
        this.update();
    }

    get projection(): 'orthographic' | 'perspective' {
        return this._projection;
    }

    set projection(p: 'orthographic' | 'perspective') {
        this._projection = p;
        this.update();
    }

    /** the active three.js camera */
    get camera(): OrthographicCamera | PerspectiveCamera {
        return this._projection === 'orthographic' ? this.ortho : this.perspective;
    }

    /** distance from the target that gives `zoom` px per unit (perspective) */
    get distance(): number {
        const halfFov = MathUtils.degToRad(this.perspective.fov) / 2;
        return this.height / 2 / Math.tan(halfFov) / this.zoom;
    }

    resize(width: number, height: number): void {
        this.width = Math.max(1, width);
        this.height = Math.max(1, height);
        this.update();
    }

    /** Recomputes both cameras from the rig; the other methods call it. */
    update(): void {
        if (!this.orbit) this.yaw = this.pitch = 0;
        this.pitch = MathUtils.clamp(this.pitch, -this.maxPitch, this.maxPitch);
        this.zoom = MathUtils.clamp(this.zoom, this.minZoom, this.maxZoom);

        const dir = new Vector3(
            Math.sin(this.yaw) * Math.cos(this.pitch),
            Math.sin(this.pitch),
            Math.cos(this.yaw) * Math.cos(this.pitch),
        );

        const p = this.perspective;
        p.aspect = this.width / this.height;
        p.position.copy(this.target).addScaledVector(dir, this.distance);
        p.near = Math.max(0.01, this.distance / 1000);
        p.far = this.distance * 1000;
        p.lookAt(this.target);
        p.updateProjectionMatrix();

        const o = this.ortho;
        const hw = this.width / 2 / this.zoom;
        const hh = this.height / 2 / this.zoom;
        o.left = -hw;
        o.right = hw;
        o.top = hh;
        o.bottom = -hh;
        // far enough back that nothing in a sane scene is behind it
        const back = Math.max(1e4, (Math.max(hw, hh) * 20));
        o.near = 0.1;
        o.far = back * 2;
        o.position.copy(this.target).addScaledVector(dir, back);
        o.lookAt(this.target);
        o.updateProjectionMatrix();

        p.updateMatrixWorld();
        o.updateMatrixWorld();
    }

    /** A ray from the camera through the screen point (CSS px). */
    rayAt(sx: number, sy: number): Raycaster {
        this.ndc.set((sx / this.width) * 2 - 1, -(sy / this.height) * 2 + 1);
        this.raycaster.setFromCamera(this.ndc, this.camera as Camera);
        return this.raycaster;
    }

    /**
     * The world point under the screen point on the plane `z = planeZ` (default: through the
     * target), or null if the view is edge-on to it.
     */
    screenToWorld(sx: number, sy: number, planeZ = this.target.z, out = new Vector3()): Vector3 | null {
        this.plane.set(new Vector3(0, 0, 1), -planeZ);
        return this.rayAt(sx, sy).ray.intersectPlane(this.plane, out);
    }

    /** The screen point (CSS px) of a world point; `z` > 1 means behind the camera. */
    worldToScreen(point: Vector3): { x: number; y: number; z: number } {
        const v = point.clone().project(this.camera);
        return { x: (v.x + 1) / 2 * this.width, y: (1 - v.y) / 2 * this.height, z: v.z };
    }

    /** Pans by a screen-space delta: the world follows the pointer. */
    pan(dx: number, dy: number): void {
        const cam = this.camera;
        const right = new Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
        const up = new Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
        this.target.addScaledVector(right, -dx / this.zoom).addScaledVector(up, dy / this.zoom);
        this.update();
    }

    /** Orbits by a screen-space delta (no-op while `orbit` is false). */
    rotate(dx: number, dy: number, speed = 0.005): void {
        if (!this.orbit) return;
        this.yaw -= dx * speed;
        this.pitch += dy * speed;
        this.update();
    }

    /** Zooms by `factor`, keeping the world point under (sx, sy) fixed where possible. */
    zoomAt(sx: number, sy: number, factor: number): void {
        const before = this.screenToWorld(sx, sy);
        this.zoom *= factor;
        this.update();
        const after = before && this.screenToWorld(sx, sy);
        if (before && after) {
            this.target.add(before.sub(after));
            this.update();
        }
    }

    /**
     * Frames a box on the XY plane inside the view, leaving `margin` CSS px and keeping
     * clear of `insets` (screen edges covered by UI). Keeps yaw/pitch.
     */
    fit(minX: number, minY: number, maxX: number, maxY: number, insets: ViewInsets = { l: 0, r: 0, t: 0, b: 0 }, margin = 48, maxZoom = 2): void {
        const w = Math.max(1e-6, maxX - minX);
        const h = Math.max(1e-6, maxY - minY);
        const viewW = Math.max(1, this.width - insets.l - insets.r - margin * 2);
        const viewH = Math.max(1, this.height - insets.t - insets.b - margin * 2);
        this.zoom = MathUtils.clamp(Math.min(viewW / w, viewH / h), this.minZoom, Math.min(maxZoom, this.maxZoom));
        this.target.set((minX + maxX) / 2, (minY + maxY) / 2, this.target.z);
        this.update();
        // shift so the box is centered in the uncovered area, not the whole canvas
        this.pan((insets.l - insets.r) / 2, (insets.t - insets.b) / 2);
    }
}
