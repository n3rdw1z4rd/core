import { BufferGeometry, Float32BufferAttribute } from "three";
import { Map3D } from "../map3d";
import { rng } from "../rng";
import type { ColorPalette } from "../color-palette";

export class VoxelGeometry extends BufferGeometry {
    type = 'VoxelGeometry';

    voxels = new Map3D();
    voxelBuildParams: BuildVoxelGeometryParams = {};

    updateGeometry(params?: BuildVoxelGeometryParams): void {
        BuildVoxelGeometry(this.voxels, {
            ...(params ?? this.voxelBuildParams),
            voxelGeometry: this,
        });
    }
}

export interface BuildVoxelGeometryParams {
    includeHiddenFaces?: boolean;
    smoothNormals?: boolean;
    palette?: ColorPalette;
    voxelGeometry?: VoxelGeometry;
}

export function BuildVoxelGeometry(
    voxelMap: Map3D,
    params: BuildVoxelGeometryParams,
): VoxelGeometry {
    const includeHiddenFaces = params.includeHiddenFaces ?? false;
    const smoothNormals = params.smoothNormals ?? false;
    const palette = params.palette ?? [];

    const positions: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    function pushColor(hex: number) {
        colors.push(
            ((hex >> 16) & 0xff) / 255,
            ((hex >> 8) & 0xff) / 255,
            (hex & 0xff) / 255,
        );
    }

    function emitFace(face: VoxelFace, x: number, y: number, z: number, color: number) {
        const index = positions.length / 3;
        const vertices = face.vertices;

        for (let i = 0; i < vertices.length; i += 3) {
            positions.push(
                (x + vertices[i]),
                (y + vertices[i + 1]),
                (z + vertices[i + 2]),
            );

            normals.push(
                face.normal[0],
                face.normal[1],
                face.normal[2],
            );

            pushColor(color);
        }

        indices.push(
            index,
            index + 1,
            index + 2,
            index,
            index + 2,
            index + 3,
        );
    }

    function randomColor(): number { return rng.range(256 ** 3); }

    voxelMap.forEach((x: number, y: number, z: number, n: number) => {
        const color = palette[n] ?? randomColor();

        for (const face of VOXEL_FACES) {
            const neighbor =
                voxelMap.get(
                    x + face.normal[0],
                    y + face.normal[1],
                    z + face.normal[2],
                );

            if (neighbor !== voxelMap.defaultValue && !includeHiddenFaces) continue;

            emitFace(face, x, y, z, color);
        }
    });

    const geometry = params.voxelGeometry ?? new VoxelGeometry();

    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));

    geometry.setIndex(indices);

    if (smoothNormals) geometry.computeVertexNormals();

    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    return geometry;
}

export interface VoxelFace {
    readonly normal: readonly [number, number, number];
    readonly vertices: readonly number[];
}

export const VOXEL_FACES: readonly VoxelFace[] = [
    // +X
    {
        normal: [1, 0, 0],
        vertices: [
            1, 0, 0,
            1, 1, 0,
            1, 1, 1,
            1, 0, 1,
        ],
    },

    // -X
    {
        normal: [-1, 0, 0],
        vertices: [
            0, 0, 1,
            0, 1, 1,
            0, 1, 0,
            0, 0, 0,
        ],
    },

    // +Y
    {
        normal: [0, 1, 0],
        vertices: [
            0, 1, 0,
            0, 1, 1,
            1, 1, 1,
            1, 1, 0,
        ],
    },

    // -Y
    {
        normal: [0, -1, 0],
        vertices: [
            1, 0, 0,
            1, 0, 1,
            0, 0, 1,
            0, 0, 0,
        ],
    },

    // +Z
    {
        normal: [0, 0, 1],
        vertices: [
            1, 0, 1,
            1, 1, 1,
            0, 1, 1,
            0, 0, 1,
        ],
    },

    // -Z
    {
        normal: [0, 0, -1],
        vertices: [
            0, 0, 0,
            0, 1, 0,
            1, 1, 0,
            1, 0, 0,
        ],
    },
] as const;
