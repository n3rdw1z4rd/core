import { BufferAttribute, BufferGeometry, Color, Mesh, MeshBasicMaterial, MeshLambertMaterial, MeshPhongMaterial, MeshPhysicalMaterial, MeshStandardMaterial, type ColorRepresentation } from 'three';

export type Voxel = { x: number, y: number, z: number, color: number };
export type VoxelMap = Map<string, number>;
export type VoxelMaterial = MeshBasicMaterial | MeshLambertMaterial | MeshPhongMaterial | MeshStandardMaterial | MeshPhysicalMaterial;

export interface VoxelData {
    name: string,
    width: number,
    depth: number,
    height: number,
    palette: ColorRepresentation[],
    voxels: Voxel[],
}

export class VoxelMesh extends Mesh {
    readonly type: string = 'VoxelMesh';

    width: number;
    depth: number;
    height: number;

    colorPalette: ColorRepresentation[];
    voxels: VoxelMap;

    needsGeometryUpdate: boolean = true;

    constructor(
        width: number,
        depth: number,
        height: number,
        material: VoxelMaterial,
        name?: string,
    ) {
        super();

        this.width = width;
        this.depth = depth;
        this.height = height;

        this.material = material;
        this.material.vertexColors = true;

        this.name = name ?? 'VoxelMesh';
        this.colorPalette = BuildDefaultPalette();

        this.voxels = new Map();
        this.geometry = new BufferGeometry();

        this.updateGeometry();
    }

    private _xyz2k(x: number, y: number, z: number): string {
        x = Math.abs(Math.floor(x));
        y = Math.abs(Math.floor(y));
        z = Math.abs(Math.floor(z));

        return `${x},${y},${z}`;
    }

    private _k2xyz(k: string): { x: number, y: number, z: number } {
        const [x, y, z] = k.split(',').map((s: string) => parseInt(s));
        return { x, y, z };
    }

    get(x: number, y: number, z: number): number {
        let n = -1;

        if (
            x >= 0 && y >= 0 && z >= 0 &&
            x < this.width && y < this.height && z < this.depth
        ) {
            n = this.voxels.get(this._xyz2k(x, y, z)) ?? -1;
        }

        return n;
    }

    set(x: number, y: number, z: number, n?: number) {
        if (
            x >= 0 && y >= 0 && z >= 0 &&
            x < this.width && y < this.height && z < this.depth
        ) {
            if (n === undefined) this.voxels.delete(this._xyz2k(x, y, z));
            else this.voxels.set(this._xyz2k(x, y, z), n);

            this.needsGeometryUpdate = true;
        }
    }

    clearVoxels() {
        this.voxels.clear();
    }

    setSize(width: number, depth: number, height: number) {
        this.forEachVoxel((x: number, y: number, z: number) => {
            if (x >= width || y >= height || z >= depth) this.set(x, y, z);
        });

        this.width = width;
        this.depth = depth;
        this.height = height;

        this.needsGeometryUpdate = true;
    }

    forEachVoxel(callback: (x: number, y: number, z: number, n: number) => void) {
        this.voxels.forEach((n: number, k: string) => {
            const { x, y, z } = this._k2xyz(k);
            callback(x, y, z, n);
        });
    }

    importVoxelData(voxelData: VoxelData) {
        this.clearVoxels();

        this.name = voxelData.name;
        this.setSize(voxelData.width, voxelData.depth, voxelData.height);

        voxelData.palette.forEach((color: ColorRepresentation, i: number) => {
            if (i < this.colorPalette.length) {
                this.colorPalette[i] = color;
            } else {
                this.colorPalette.push(color);
            }
        });

        voxelData.voxels.forEach((voxel: { x: number, y: number, z: number, color: number }) => {
            const { x, y, z, color } = voxel;
            this.set(x, y, z, color);
        });

        this.updateGeometry();
    }

    updateGeometry() {
        if (this.needsGeometryUpdate) {
            const positions: number[] = [];
            const normals: number[] = [];
            const colors: number[] = [];
            const indices: number[] = [];

            this.forEachVoxel((x: number, y: number, z: number, n: number) => {
                VoxelFaces.forEach((faces: Array<number[]>) => {
                    const [dx, dy, dz] = faces[0];
                    const neighborVoxel = this.get(x + dx, y + dy, z + dz);

                    if (neighborVoxel < 0) {
                        const positionIndex = positions.length / 3;

                        faces.forEach((face: number[]) => {
                            const [nx, ny, nz, px, py, pz] = face;

                            positions.push(x + px, y + py, z + pz);
                            normals.push(nx, ny, nz);

                            const { r, g, b } = new Color(this.colorPalette[n]);
                            colors.push(r, g, b, 1);
                        });

                        indices.push(
                            positionIndex, positionIndex + 1, positionIndex + 2,
                            positionIndex + 2, positionIndex + 1, positionIndex + 3,
                        );
                    }
                });
            });

            this.geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
            this.geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
            this.geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 4));
            this.geometry.setIndex(indices);
            this.geometry.computeBoundingSphere();

            this.updateMatrixWorld();
        }

        this.needsGeometryUpdate = false;
    }

    exportData(): VoxelData {
        const voxelData: VoxelData = {
            name: this.name,
            width: this.width,
            depth: this.depth,
            height: this.height,
            palette: [...this.colorPalette],
            voxels: [],
        };

        this.forEachVoxel((x: number, y: number, z: number, color: number) => {
            voxelData.voxels.push({ x, y, z, color });
        });

        return voxelData;
    }
}

export const VoxelFaces: Array<Array<number[]>> = [ // [nx, ny, nz, px, py, pz]
    [ //left
        [-1, 0, 0, 0, 1, 0],
        [-1, 0, 0, 0, 0, 0],
        [-1, 0, 0, 0, 1, 1],
        [-1, 0, 0, 0, 0, 1],
    ],

    [ //right
        [1, 0, 0, 1, 1, 1],
        [1, 0, 0, 1, 0, 1],
        [1, 0, 0, 1, 1, 0],
        [1, 0, 0, 1, 0, 0],
    ],

    [ //bottom
        [0, -1, 0, 1, 0, 1],
        [0, -1, 0, 0, 0, 1],
        [0, -1, 0, 1, 0, 0],
        [0, -1, 0, 0, 0, 0],
    ],

    [ //top
        [0, 1, 0, 0, 1, 1],
        [0, 1, 0, 1, 1, 1],
        [0, 1, 0, 0, 1, 0],
        [0, 1, 0, 1, 1, 0],
    ],

    [ //back
        [0, 0, -1, 1, 0, 0],
        [0, 0, -1, 0, 0, 0],
        [0, 0, -1, 1, 1, 0],
        [0, 0, -1, 0, 1, 0],
    ],

    [ //front
        [0, 0, 1, 0, 0, 1],
        [0, 0, 1, 1, 0, 1],
        [0, 0, 1, 0, 1, 1],
        [0, 0, 1, 1, 1, 1],
    ],
];

export function BuildDefaultPalette(palette?: ColorRepresentation[]): ColorRepresentation[] {
    palette = palette ?? Colors.rgb48;

    const grayscale = [];
    const count = 16;

    for (let i = 0; i < count; i++) {
        const grey = Math.floor((i / count) * 255);
        grayscale.push(`rgb(${grey}, ${grey}, ${grey})`);
    }

    return [...palette, ...grayscale];
}

export const Colors = {
    rgb12: [
        '#FF0000', '#FF8800', '#FFFF00', '#88FF00',
        '#00FF00', '#00FF88', '#00FFFF', '#0088FF',
        '#0000FF', '#8800FF', '#FF00FF', '#FF0080',],
    rgb24: [
        '#FF0000', '#FF4000', '#FF8000', '#FFBF00',
        '#FFFF00', '#CCFF00', '#80FF00', '#40FF00',
        '#00FF00', '#00FF40', '#00FF80', '#00FFCC',
        '#00FFFF', '#00CCFF', '#0080FF', '#0040FF',
        '#0000FF', '#4000FF', '#8000FF', '#CC00FF',
        '#FF00FF', '#FF00CC', '#FF0080', '#FF0040',],
    rgb48: [
        '#FF0000', '#FF2000', '#FF4000', '#FF6000',
        '#FF8000', '#FFAA00', '#FFCC00', '#FFEE00',
        '#FFFF00', '#DDFF00', '#CCFF00', '#AAFF00',
        '#80FF00', '#60FF00', '#40FF00', '#20FF00',
        '#00FF00', '#00FF20', '#00FF40', '#00FF60',
        '#00FF80', '#00FFAA', '#00FFCC', '#00FFDD',
        '#00FFFF', '#00DDFF', '#00CCFF', '#0099FF',
        '#0080FF', '#0060FF', '#0040FF', '#0020FF',
        '#0000FF', '#2000FF', '#4000FF', '#6000FF',
        '#8000FF', '#AA00FF', '#CC00FF', '#DD00FF',
        '#FF00FF', '#FF00EE', '#FF00CC', '#FF00AA',
        '#FF0080', '#FF0060', '#FF0040', '#FF0020',],
    rgb64: [
        '#000000', '#000055', '#0000AA', '#0000FF',
        '#005500', '#005555', '#0055AA', '#0055FF',
        '#00AA00', '#00AA55', '#00AAAA', '#00AAFF',
        '#00FF00', '#00FF55', '#00FFAA', '#00FFFF',
        '#550000', '#550055', '#5500AA', '#5500FF',
        '#555500', '#555555', '#5555AA', '#5555FF',
        '#55AA00', '#55AA55', '#55AAAA', '#55AAFF',
        '#55FF00', '#55FF55', '#55FFAA', '#55FFFF',
        '#AA0000', '#AA0055', '#AA00AA', '#AA00FF',
        '#AA5500', '#AA5555', '#AA55AA', '#AA55FF',
        '#AAAA00', '#AAAA55', '#AAAAAA', '#AAAAFF',
        '#AAFF00', '#AAFF55', '#AAFFAA', '#AAFFFF',
        '#FF0000', '#FF0055', '#FF00AA', '#FF00FF',
        '#FF5500', '#FF5555', '#FF55AA', '#FF55FF',
        '#FFAA00', '#FFAA55', '#FFAAAA', '#FFAAFF',
        '#FFFF00', '#FFFF55', '#FFFFAA', '#FFFFFF',
    ]
};
