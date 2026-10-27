import { BufferAttribute, BufferGeometry, Color, LineBasicMaterial, LineSegments, Vector3, type ColorRepresentation } from 'three';
import type { EditorCamera } from './editor-camera';

/**
 * An infinite-looking grid on the XY plane for editor views: each {@link AdaptiveGrid.update}
 * rebuilds just the lines in view, doubling the spacing when zoomed out so lines never get
 * closer than `minSpacingPx`. Optional origin cross.
 *
 * ```ts
 * const grid = new AdaptiveGrid({ color: '#262626' });
 * scene.add(grid);
 * // per frame, after moving the camera:
 * grid.update(view, 32);
 * ```
 *
 * @category Three.js
 */
export class AdaptiveGrid extends LineSegments<BufferGeometry, LineBasicMaterial> {
    minSpacingPx: number;
    /** draw the grid lines (false: just the origin cross, if `origin`) */
    lines = true;
    /** draw a small cross at the origin (`originSizePx` long) */
    origin: boolean;
    originSizePx: number;
    /** the most lines per axis (a far-off perspective view stops there) */
    maxLines = 400;

    private readonly gridColor: Color;
    private readonly originColor: Color;
    private positions = new Float32Array(0);
    private colors = new Float32Array(0);

    constructor(options: { color?: ColorRepresentation; originColor?: ColorRepresentation; minSpacingPx?: number; origin?: boolean; originSizePx?: number } = {}) {
        super(new BufferGeometry(), new LineBasicMaterial({ vertexColors: true, depthWrite: false, transparent: true }));
        this.gridColor = new Color(options.color ?? '#262626');
        this.originColor = new Color(options.originColor ?? '#555555');
        this.minSpacingPx = options.minSpacingPx ?? 8;
        this.origin = options.origin ?? true;
        this.originSizePx = options.originSizePx ?? 10;
        this.frustumCulled = false;
        this.renderOrder = -1;
    }

    /** Rebuilds the lines for the current view; `cell` is the base spacing in world units. */
    update(view: EditorCamera, cell: number, z = 0): void {
        let step = cell;
        while (step * view.zoom < this.minSpacingPx) step *= 2;

        // the visible region of the plane: the screen corners (plus center) projected onto it
        const pts = [[0, 0], [view.width, 0], [0, view.height], [view.width, view.height], [view.width / 2, view.height / 2]]
            .map(([x, y]) => view.screenToWorld(x, y, z))
            .filter((p): p is Vector3 => p !== null);
        const far = step * this.maxLines / 2;
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const p of pts) {
            x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
            y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
        }
        if (!pts.length || pts.length < 5) {
            // looking at the horizon: a fixed-size patch around the target
            x0 = view.target.x - far; x1 = view.target.x + far;
            y0 = view.target.y - far; y1 = view.target.y + far;
        }
        x0 = Math.max(x0, view.target.x - far); x1 = Math.min(x1, view.target.x + far);
        y0 = Math.max(y0, view.target.y - far); y1 = Math.min(y1, view.target.y + far);
        x0 = Math.floor(x0 / step) * step; x1 = Math.ceil(x1 / step) * step;
        y0 = Math.floor(y0 / step) * step; y1 = Math.ceil(y1 / step) * step;

        const nx = this.lines ? Math.max(0, Math.round((x1 - x0) / step) + 1) : 0;
        const ny = this.lines ? Math.max(0, Math.round((y1 - y0) / step) + 1) : 0;
        const segments = nx + ny + (this.origin ? 2 : 0);
        this.ensure(segments * 2);

        const pos = this.positions;
        const col = this.colors;
        const gc = this.gridColor;
        let i = 0;
        const seg = (ax: number, ay: number, bx: number, by: number, c: Color) => {
            pos[i * 3] = ax; pos[i * 3 + 1] = ay; pos[i * 3 + 2] = z;
            col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; i++;
            pos[i * 3] = bx; pos[i * 3 + 1] = by; pos[i * 3 + 2] = z;
            col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; i++;
        };
        for (let k = 0; k < nx; k++) seg(x0 + k * step, y0, x0 + k * step, y1, gc);
        for (let k = 0; k < ny; k++) seg(x0, y0 + k * step, x1, y0 + k * step, gc);
        if (this.origin) {
            const s = this.originSizePx / view.zoom;
            seg(-s, 0, s, 0, this.originColor);
            seg(0, -s, 0, s, this.originColor);
        }

        const g = this.geometry;
        (g.getAttribute('position') as BufferAttribute).needsUpdate = true;
        (g.getAttribute('color') as BufferAttribute).needsUpdate = true;
        g.setDrawRange(0, i);
    }

    private ensure(vertices: number): void {
        if (this.positions.length >= vertices * 3) return;
        const size = Math.max(vertices * 3, this.positions.length * 2, 64 * 3);
        this.positions = new Float32Array(size);
        this.colors = new Float32Array(size);
        this.geometry.setAttribute('position', new BufferAttribute(this.positions, 3));
        this.geometry.setAttribute('color', new BufferAttribute(this.colors, 3));
    }

    dispose(): void {
        this.geometry.dispose();
        this.material.dispose();
    }
}
