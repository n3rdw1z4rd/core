import { BufferAttribute, BufferGeometry } from 'three';
import { Color } from '../renderer/webgl';
import { vec3 } from 'gl-matrix';

export function xyz2key(x: number, y: number, z: number): string {
    return `${x},${y},${z}`;
}

export function key2xyz(key: string): [number, number, number] {
    return key.split(',').map((v: string) => parseFloat(v)) as [number, number, number];
}

export class VoxelGeometry extends BufferGeometry {
    private _voxels: Map<string, number> = new Map();

    public colors: Color[] = [
        [1, 0, 0, 1], // Red
        [0, 1, 0, 1], // Green
        [0, 0, 1, 1], // Blue
    ];

    constructor() {
        super();

        const size = 1;

        for (let x = -size; x <= size; x++) {
            for (let y = -size; y <= size; y++) {
                for (let z = -size; z <= size; z++) {
                    // this.set(x, y, z, rng.range(this.colors.length));
                    this._voxels.set(xyz2key(x, y, z), 2);//rng.range(this.colors.length));
                }
            }
        }

        this.updateGeometry();
    }

    public get(x: number, y: number, z: number): number | undefined {
        return this._voxels.get(xyz2key(x, y, z));
    }

    public set(x: number, y: number, z: number, value: number) {
        this._voxels.set(xyz2key(x, y, z), value);
    }

    public getVoxelCoordsFromFaceIndex(faceIndex: number, size: number, height: number): vec3 {
        const facePerVoxel = 6; // 6 faces per voxel
        const triangleIndex = Math.floor(faceIndex / 2); // Two triangles per face
        const voxelIndex = Math.floor(triangleIndex / facePerVoxel); // Find voxel index

        // Convert 1D index to 3D coordinates
        const x = voxelIndex % size;
        const y = Math.floor((voxelIndex / size) % height);
        const z = Math.floor(voxelIndex / (size * height));

        return vec3.fromValues(x, y, z);
    }

    // public changeVoxelColor(faceIndex: number, newColor: THREE.Color) {
    //     const colorAttr = voxelMesh.geometry.getAttribute("color") as THREE.BufferAttribute;

    //     if (!colorAttr) return; // Ensure the color attribute exists

    //     const colors = colorAttr.array as Float32Array;

    //     // Each face has 3 vertices, each vertex has 4 components (RGBA)
    //     const vertexIndex = faceIndex * 3 * 4; // Multiply by 4 because each vertex has RGBA

    //     for (let i = 0; i < 3; i++) { // Update all three vertices of the face
    //         colors[vertexIndex + i * 4] = newColor.r;
    //         colors[vertexIndex + i * 4 + 1] = newColor.g;
    //         colors[vertexIndex + i * 4 + 2] = newColor.b;
    //         colors[vertexIndex + i * 4 + 3] = 1; // Ensure full opacity
    //     }

    //     colorAttr.needsUpdate = true; // Tell Three.js to update the buffer
    // }

    public updateGeometry() {
        const positions: number[] = [];
        const normals: number[] = [];
        const colors: number[] = [];
        // const uvs: number[] = [];
        const indices: number[] = [];

        let needsUpdate: boolean = false;

        this._voxels.forEach((voxel: number, key: string) => {
            if (voxel) {
                const [x, y, z] = key2xyz(key);

                VoxelFaces.forEach((faces: Array<number[]>) => {
                    const [dx, dy, dz] = faces[0];
                    const neighborVoxel = this.get(x + dx, y + dy, z + dz) ?? 0;

                    if (!neighborVoxel) {
                        const positionIndex = positions.length / 3;

                        faces.forEach((faceVerts: number[]) => {
                            const [nx, ny, nz, px, py, pz, /*ux, uy*/] = faceVerts;

                            positions.push(x + px, y + py, z + pz);
                            normals.push(nx, ny, nz);
                            colors.push(...this.colors[voxel - 1]);
                            // uvs.push(...(this.material as TextureAtlas).getUv(voxel - 1, ux, uy));
                            // uvs.push(ux, uy);
                        });

                        indices.push(
                            positionIndex, positionIndex + 1, positionIndex + 2,
                            positionIndex + 2, positionIndex + 1, positionIndex + 3,
                        );

                        needsUpdate = true;
                    }
                });

                this.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
                this.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
                this.setAttribute('color', new BufferAttribute(new Float32Array(colors), 4));
                // this.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));

                this.setIndex(indices);
            }
        });

        if (needsUpdate) {
            this.attributes.position.needsUpdate = true;
            this.computeVertexNormals();
        }
    }
}

const lo = -0.5;
const hi = 0.5;

const VoxelFaces: Array<Array<number[]>> = [ // [nx, ny, nz, px, py, pz, ux, uy]
    [ //left
        [-1, 0, 0, lo, hi, lo, 0, 1],
        [-1, 0, 0, lo, lo, lo, 0, 0],
        [-1, 0, 0, lo, hi, hi, 1, 1],
        [-1, 0, 0, lo, lo, hi, 1, 0],
    ],

    [ //right
        [1, 0, 0, hi, hi, hi, 0, 1],
        [1, 0, 0, hi, lo, hi, 0, 0],
        [1, 0, 0, hi, hi, lo, 1, 1],
        [1, 0, 0, hi, lo, lo, 1, 0],
    ],

    [ //bottom
        [0, -1, 0, hi, lo, hi, 1, 0],
        [0, -1, 0, lo, lo, hi, 0, 0],
        [0, -1, 0, hi, lo, lo, 1, 1],
        [0, -1, 0, lo, lo, lo, 0, 1],
    ],

    [ //top
        [0, 1, 0, lo, hi, hi, 1, 1],
        [0, 1, 0, hi, hi, hi, 0, 1],
        [0, 1, 0, lo, hi, lo, 1, 0],
        [0, 1, 0, hi, hi, lo, 0, 0],
    ],

    [ //back
        [0, 0, -1, hi, lo, lo, 0, 0],
        [0, 0, -1, lo, lo, lo, 1, 0],
        [0, 0, -1, hi, hi, lo, 0, 1],
        [0, 0, -1, lo, hi, lo, 1, 1],
    ],

    [ //front
        [0, 0, 1, lo, lo, hi, 0, 0],
        [0, 0, 1, hi, lo, hi, 1, 0],
        [0, 0, 1, lo, hi, hi, 0, 1],
        [0, 0, 1, hi, hi, hi, 1, 1],
    ],
];
