# Three.js Meshes & Textures

`import { ... } from '@n3rdw1z4rd/core/three';` (or the top-level barrel)

## VoxelMesh

A `Mesh` subclass backed by a sparse voxel map, with per-face culling (only builds geometry for faces adjacent to empty space) and a built-in color palette system. This replaced an earlier, buggier `voxel-geometry.ts` that rebuilt its buffer attributes on every single voxel change instead of once per `updateGeometry()` call.

```ts
type Voxel = { x: number, y: number, z: number, color: number }; // color is a palette index
type VoxelMaterial = MeshBasicMaterial | MeshLambertMaterial | MeshPhongMaterial | MeshStandardMaterial | MeshPhysicalMaterial;

interface VoxelData {
    name: string;
    width: number; depth: number; height: number;
    palette: ColorRepresentation[];
    voxels: Voxel[];
}

class VoxelMesh extends Mesh {
    width: number; depth: number; height: number;
    colorPalette: ColorRepresentation[];
    needsGeometryUpdate: boolean;

    constructor(width: number, depth: number, height: number, material: VoxelMaterial, name?: string);

    get(x: number, y: number, z: number): number;       // -1 if empty/out of bounds
    set(x: number, y: number, z: number, n?: number): void; // n === undefined clears the voxel
    clearVoxels(): void;
    setSize(width: number, depth: number, height: number): void; // trims any voxels now out of bounds
    forEachVoxel(callback: (x: number, y: number, z: number, n: number) => void): void;
    updateGeometry(): void; // rebuilds the mesh's BufferGeometry - only does work if needsGeometryUpdate is true
    importVoxelData(voxelData: VoxelData): void; // replaces size/palette/voxels and calls updateGeometry()
    exportData(): VoxelData;
}

const VoxelFaces: Array<Array<number[]>>; // raw face-culling table, if you need it directly
function BuildDefaultPalette(palette?: ColorRepresentation[]): ColorRepresentation[]; // palette + 16-step grayscale ramp
const Colors: { rgb12: string[], rgb24: string[], rgb48: string[], rgb64: string[] }; // preset hex palettes
```

```ts
import { VoxelMesh, Colors } from '@n3rdw1z4rd/core/three';
import { MeshLambertMaterial } from 'three';

const mesh = new VoxelMesh(16, 16, 16, new MeshLambertMaterial(), 'terrain');
mesh.colorPalette = [...Colors.rgb24, ...mesh.colorPalette];

mesh.set(0, 0, 0, 2); // palette index 2
mesh.updateGeometry();
scene.add(mesh);
```

`set()`/`clearVoxels()`/`setSize()` all mark `needsGeometryUpdate = true` but don't rebuild the geometry themselves - batch your voxel edits, then call `updateGeometry()` once.

## TextureAtlas / AtlasTextureMaterial

Two independent atlas-material approaches, kept side by side rather than merged, because they compute UVs differently (grid-divisor vs. pixel-based tile size):

```ts
interface TextureData { width: number, height: number, texture: Texture }
function LoadTexture(url: string): Promise<TextureData>;
function CreateSubTexture(texture: Texture, x: number, y: number, w: number, h: number): Texture; // clones + offsets/repeats a pixel sub-region

class TextureAtlas extends MeshLambertMaterial {
    constructor(textureData: TextureData, textureWidth: number, textureHeight?: number, params?: MeshLambertMaterialParameters);
    getUv(voxel: number, ux: number, uy: number): vec2; // voxel = tile index along a single-row grid
    static CreateFromUrl(url: string, textureWidth: number, textureHeight?: number, params?: MeshLambertMaterialParameters): Promise<TextureAtlas>;
}

interface AtlasParams {
    tilePixelWidth?: number;         // default 16
    tilePixelHeight?: number;        // default 16
    tilePixelOffsetWidth?: number;   // pixel margin/border to skip, default 0
    tilePixelOffsetHeight?: number;
}

class AtlasTextureMaterial extends MeshLambertMaterial {
    constructor(textureData: TextureData, atlasParams?: AtlasParams, materialParams?: MeshLambertMaterialParameters);
    getTileUVs(tileIndex: number, vertexIndex: number): [number, number]; // vertexIndex 0-3: bottom-left, bottom-right, top-left, top-right
    static fromUrl(url: string, atlasParams?: AtlasParams, materialParams?: MeshLambertMaterialParameters): Promise<AtlasTextureMaterial>;
}
```

`TextureAtlas` assumes a simple single-row tile grid addressed by one `voxel` index; `AtlasTextureMaterial` supports a full 2D grid (row/col derived from `tileIndex` and `tilePixelWidth`) plus a pixel offset for atlases with a border. Reach for `AtlasTextureMaterial` for anything beyond a strip of tiles.

`CreateSubTexture` is a standalone helper independent of both classes - useful when you just need one cropped/repeated `Texture` (e.g. for a `MeshBasicMaterial` that isn't going through either atlas class).

## CubeSphereGeometry

A `BoxGeometry` whose vertices are normalized and pushed out to a sphere - the "spherified cube" technique - with an optional fractal Brownian motion displacement pass for terrain-like planetoids.

```ts
class CubeSphereGeometry extends BoxGeometry {
    constructor(size: number, segments: number);
    applyFractalBrownianMotion(octaves: number, persistence: number, scale: number, amplitude: number): void;
}
```

```ts
import { CubeSphereGeometry } from '@n3rdw1z4rd/core/three';

const geometry = new CubeSphereGeometry(10, 32);
geometry.applyFractalBrownianMotion(4, 0.5, 1.5, 0.3);
```

`applyFractalBrownianMotion` uses `Noise.noise3d` (see [noise.md](noise.md)) internally - each call re-displaces from the already-spherified positions, so calling it twice compounds the effect rather than resetting first.

## AsteroidMesh

An `IcosahedronGeometry`-based rock, displaced by 3D simplex noise (via the `simplex-noise` npm package directly, seeded from this library's `rng`) - a different displacement technique than `CubeSphereGeometry`'s fBm.

```ts
interface AsteroidOptions {
    radius?: number;          // default 1
    detail?: number;          // icosahedron subdivision level, default 1
    noiseScale?: number;      // default 1.0
    displacement?: number;    // default 0.1
    secondaryNoise?: boolean; // layer in a second, higher-frequency noise pass, default false
    color?: number;           // default 0x888888
}

class AsteroidMesh extends Mesh {
    constructor(options?: AsteroidOptions);
}
```

## Starfield generators

```ts
function CreateStarfield(radius?: number, count?: number, color?: number): Points; // default radius 1000, count 5000
function CreateSystemStar(position?: Vector3): Group; // an emissive sphere + PointLight, for a system's central star
```

```ts
import { CreateStarfield, CreateSystemStar } from '@n3rdw1z4rd/core/three';

scene.add(CreateStarfield());
scene.add(CreateSystemStar());
```
