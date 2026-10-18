import { BufferGeometry, Color, Float32BufferAttribute } from 'three';
import { Map3D } from '../map3d';
import { Random } from '../random';
import type { ColorPalette } from '../color-palette';

/**
 * Options for {@link buildVoxelGeometry} and {@link VoxelGeometry}.
 *
 * @category Voxels
 */
export interface BuildVoxelGeometryOptions {
    /** voxel value -> 0xRRGGBB (sRGB) */
    palette?: ColorPalette,
    /** color for values the palette doesn't cover; default: a stable color hashed from the value */
    missingColor?: number,
    /** voxel lookup where this map has none (e.g. neighbouring chunks) */
    neighbor?: (x: number, y: number, z: number) => number,
    /** also emit faces between two solid voxels. Default false. */
    includeHiddenFaces?: boolean,
    /** merge same-looking faces into larger quads. Default true. */
    greedy?: boolean,
    /** darken vertices in corners and creases. Default true. */
    ambientOcclusion?: boolean,
    /** 0..1: how dark the most occluded corner gets. Default 0.5. */
    aoStrength?: number,
    /** rebuild into this geometry instead of creating one */
    target?: BufferGeometry,
}

interface Face {
    u: number,
    v: number,
    color: number,
    /** per corner (0,0) (1,0) (1,1) (0,1) in (u, v): 0 = most occluded, 3 = open */
    ao: number[],
    /** faces with the same signature may be merged: color and the four AO values */
    sig: number,
}

// numeric (u, v) key within one slice; about ±33 million per axis
const cellKey = (u: number, v: number): number => (u + 0x2000000) * 0x4000000 + (v + 0x2000000);

// numeric plane key: slice, axis (0-2) and side; sorts by slice, then axis and side
const planeKey = (d: number, side: number, slice: number): number => (slice + 0x2000000) * 8 + d * 2 + (side > 0 ? 1 : 0);

/**
 * Builds a mesh for the voxels in `voxels`: one quad per visible face, merged into larger quads
 * (`greedy`) and shaded with per-vertex ambient occlusion. A voxel's value is its palette index;
 * the map's default value means empty.
 *
 * Positions are in the map's own coordinates, so a chunk stored in chunk-local coordinates is
 * placed by positioning its mesh. Pass `neighbor` so faces against neighbouring chunks are culled
 * and their voxels count for ambient occlusion.
 *
 * The geometry has position, normal and color attributes and an index; use a material with
 * `vertexColors: true`. The output is deterministic: the same voxels and options always produce
 * the same buffers.
 *
 * ```ts
 * const voxels = new Map3D();
 * voxels.setArea(0, 0, 0, 7, 0, 7, 0); // 8x1x8 slab of palette index 0
 * voxels.set(3, 1, 3, 1);
 *
 * const geometry = buildVoxelGeometry(voxels, { palette: [0x55aa33, 0x8b5a2b] });
 * scene.add(new Mesh(geometry, new MeshLambertMaterial({ vertexColors: true })));
 * ```
 *
 * @returns `options.target` if given, otherwise a new geometry
 * @category Voxels
 */
export function buildVoxelGeometry(voxels: Map3D, options: BuildVoxelGeometryOptions = {}): BufferGeometry {
    const palette = options.palette ?? [];
    const neighbor = options.neighbor;
    const includeHiddenFaces = options.includeHiddenFaces ?? false;
    const greedy = options.greedy ?? true;
    const ambientOcclusion = options.ambientOcclusion ?? true;
    const aoStrength = options.aoStrength ?? 0.5;
    const empty = voxels.defaultValue;

    const solid = (x: number, y: number, z: number): boolean => {
        let value = voxels.get(x, y, z);

        if (value === empty && neighbor) value = neighbor(x, y, z);

        return value !== empty;
    };

    const colorOf = (value: number): number =>
        palette[value] ?? options.missingColor ?? (Random.uint(value, 1) & 0xffffff);

    // visible faces, grouped by plane: axis d (0 = x, 1 = y, 2 = z), side (+1 / -1) and slice
    const planes = new Map<number, Map<number, Face>>();
    const p = [0, 0, 0];

    voxels.forEach((x: number, y: number, z: number, value: number) => {
        const color = colorOf(value);

        for (let d = 0; d < 3; d++) {
            const ud = (d + 1) % 3;
            const vd = (d + 2) % 3;

            for (const side of [1, -1]) {
                p[0] = x; p[1] = y; p[2] = z;
                p[d] += side; // the cell this face looks into

                if (!includeHiddenFaces && solid(p[0], p[1], p[2])) continue;

                const ao = ambientOcclusion ? cornerOcclusion(solid, p, ud, vd) : [3, 3, 3, 3];
                const slice = (d === 0 ? x : d === 1 ? y : z) + (side > 0 ? 1 : 0);
                const key = planeKey(d, side, slice);

                let plane = planes.get(key);

                if (!plane) {
                    plane = new Map();
                    planes.set(key, plane);
                }

                const u = d === 0 ? y : d === 1 ? z : x;
                const v = d === 0 ? z : d === 1 ? x : y;

                const sig = color * 256 + ao[0] * 64 + ao[1] * 16 + ao[2] * 4 + ao[3];

                plane.set(cellKey(u, v), { u, v, color, ao, sig });
            }
        }
    });

    const positions: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    const linear = new Color();
    const corner = [0, 0, 0];

    const emitQuad = (d: number, side: number, slice: number, face: Face, width: number, height: number) => {
        const ud = (d + 1) % 3;
        const vd = (d + 2) % 3;
        const base = positions.length / 3;

        linear.setHex(face.color); // sRGB hex -> three's (linear) working color space

        const cornerOffsets = [[0, 0], [width, 0], [width, height], [0, height]];

        for (let c = 0; c < 4; c++) {
            corner[d] = slice;
            corner[ud] = face.u + cornerOffsets[c][0];
            corner[vd] = face.v + cornerOffsets[c][1];

            positions.push(corner[0], corner[1], corner[2]);
            normals.push(d === 0 ? side : 0, d === 1 ? side : 0, d === 2 ? side : 0);

            const shade = 1 - aoStrength * (3 - face.ao[c]) / 3;
            colors.push(linear.r * shade, linear.g * shade, linear.b * shade);
        }

        // split along the diagonal with the brighter ends, so a dark corner doesn't streak across the quad
        const ao = face.ao;
        const tris = ao[0] + ao[2] >= ao[1] + ao[3]
            ? [0, 1, 2, 0, 2, 3]
            : [0, 1, 3, 1, 2, 3];

        for (let t = 0; t < 6; t += 3) {
            // (u, v) counter-clockwise faces +d; flip the winding for -d faces
            if (side > 0) {
                indices.push(base + tris[t], base + tris[t + 1], base + tris[t + 2]);
            } else {
                indices.push(base + tris[t], base + tris[t + 2], base + tris[t + 1]);
            }
        }
    };

    // deterministic output: planes and faces in a fixed order
    const keys = [...planes.keys()].sort((a, b) => a - b);

    for (const key of keys) {
        const d = Math.floor(key / 2) % 4;
        const side = key % 2 ? 1 : -1;
        const slice = Math.floor(key / 8) - 0x2000000;
        const plane = planes.get(key)!;
        const faces = [...plane.values()].sort((a, b) => (a.v - b.v) || (a.u - b.u));
        const used = new Set<number>();

        const free = (u: number, v: number, sig: number): boolean => {
            const k = cellKey(u, v);
            return !used.has(k) && plane.get(k)?.sig === sig;
        };

        for (const face of faces) {
            if (used.has(cellKey(face.u, face.v))) continue;

            let width = 1;
            let height = 1;

            if (greedy) {
                while (free(face.u + width, face.v, face.sig)) width++;

                grow: while (true) {
                    for (let du = 0; du < width; du++) {
                        if (!free(face.u + du, face.v + height, face.sig)) break grow;
                    }

                    height++;
                }
            }

            for (let dv = 0; dv < height; dv++) {
                for (let du = 0; du < width; du++) {
                    used.add(cellKey(face.u + du, face.v + dv));
                }
            }

            emitQuad(d, side, slice, face, width, height);
        }
    }

    const geometry = options.target ?? new BufferGeometry();

    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);

    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    return geometry;
}

// classic voxel AO: for each face corner, look at the two edge neighbours and the diagonal one in
// the layer the face looks into. Returns 0 (both edges blocked) .. 3 (nothing blocking).
function cornerOcclusion(
    solid: (x: number, y: number, z: number) => boolean,
    front: number[],
    ud: number,
    vd: number,
): number[] {
    const q = [0, 0, 0];

    const at = (du: number, dv: number): boolean => {
        q[0] = front[0]; q[1] = front[1]; q[2] = front[2];
        q[ud] += du;
        q[vd] += dv;

        return solid(q[0], q[1], q[2]);
    };

    const occlusion = (su: number, sv: number): number => {
        const side1 = at(su, 0);
        const side2 = at(0, sv);

        if (side1 && side2) return 0;

        return 3 - (+side1 + +side2 + +at(su, sv));
    };

    // corners (0,0) (1,0) (1,1) (0,1) of the cell
    return [occlusion(-1, -1), occlusion(1, -1), occlusion(1, 1), occlusion(-1, 1)];
}

/**
 * Geometry that owns its voxels; call `update()` after changing them. See
 * {@link buildVoxelGeometry} for how voxels are meshed, and {@link VoxelMesh} for an editable mesh
 * that tracks changes for you.
 *
 * @category Voxels
 */
export class VoxelGeometry extends BufferGeometry {
    type = 'VoxelGeometry';

    /** voxel data (palette indices); the map's default value is empty */
    voxels: Map3D;
    /** meshing options used by every `update()` */
    options: Omit<BuildVoxelGeometryOptions, 'target'>;

    /** Builds the geometry right away. */
    constructor(voxels: Map3D = new Map3D(), options: Omit<BuildVoxelGeometryOptions, 'target'> = {}) {
        super();

        this.voxels = voxels;
        this.options = options;

        this.update();
    }

    /** Rebuilds the geometry from `voxels` and `options`. */
    update(): this {
        buildVoxelGeometry(this.voxels, { ...this.options, target: this });

        return this;
    }
}
