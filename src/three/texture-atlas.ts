import { MeshLambertMaterial, type MeshLambertMaterialParameters, NearestFilter, type Texture } from 'three';
import { LoadTexture, type TextureData } from './texture-utils';

/**
 * Texture coordinate `[u, v]`, each 0..1, with v = 1 at the image's top (three.js convention).
 *
 * @category Textures
 */
export type UV = [number, number];

/**
 * Tile layout of a {@link TextureAtlas}.
 *
 * @category Textures
 */
export interface AtlasParams {
    /** pixels, default 16 */
    tileWidth?: number,
    /** pixels, default tileWidth */
    tileHeight?: number,
    /** pixels from the left edge before the first column, default 0 */
    offsetX?: number,
    /** pixels from the top edge before the first row, default 0 */
    offsetY?: number,
    /** pixels between neighbouring tiles, default 0 */
    spacing?: number,
}

/**
 * Tile layout and UV lookup for a texture atlas (tile sheet). Tiles are numbered left to
 * right, top to bottom, starting at 0.
 *
 * Not a material: use `atlas.texture` as the `map` of any material, or `createMaterial()`
 * for the common Lambert setup. The texture's `magFilter` is set to `NearestFilter`.
 *
 * ```ts
 * const atlas = await TextureAtlas.load('tiles.png', { tileWidth: 16 });
 * const material = atlas.createMaterial();
 * const [u, v] = atlas.getUV(5, 0, 0); // bottom-left of tile 5
 * ```
 *
 * @category Textures
 */
export class TextureAtlas {
    /** the whole sheet */
    readonly texture: Texture;

    /** texture size in pixels */
    readonly width: number;
    /** texture size in pixels */
    readonly height: number;

    /** pixels */
    readonly tileWidth: number;
    /** pixels */
    readonly tileHeight: number;
    /** pixels from the left edge before the first column */
    readonly offsetX: number;
    /** pixels from the top edge before the first row */
    readonly offsetY: number;
    /** pixels between neighbouring tiles */
    readonly spacing: number;

    /** tiles per row */
    readonly columns: number;
    /** tiles per column (only whole tiles count) */
    readonly rows: number;

    /** `columns * rows` */
    get tileCount(): number { return this.columns * this.rows; }

    constructor(textureData: TextureData, params: AtlasParams = {}) {
        this.texture = textureData.texture;
        this.texture.magFilter = NearestFilter;

        this.width = textureData.width;
        this.height = textureData.height;

        this.tileWidth = params.tileWidth ?? 16;
        this.tileHeight = params.tileHeight ?? this.tileWidth;
        this.offsetX = params.offsetX ?? 0;
        this.offsetY = params.offsetY ?? 0;
        this.spacing = params.spacing ?? 0;

        // n tiles need n * tile + (n - 1) * spacing pixels
        this.columns = Math.floor((this.width - this.offsetX + this.spacing) / (this.tileWidth + this.spacing));
        this.rows = Math.floor((this.height - this.offsetY + this.spacing) / (this.tileHeight + this.spacing));
    }

    /** Loads the image at `url` (see {@link LoadTexture}) and builds an atlas from it. */
    static load(url: string, params?: AtlasParams): Promise<TextureAtlas> {
        return LoadTexture(url).then((textureData: TextureData) => new TextureAtlas(textureData, params));
    }

    /**
     * UV of a point inside a tile. `u` and `v` are in [0, 1] across the tile, with (0, 0) at the
     * tile's bottom-left and (1, 1) at its top-right, matching three.js (v = 1 is the image's top).
     */
    getUV(tile: number, u: number, v: number): UV {
        const column = tile % this.columns;
        const row = Math.floor(tile / this.columns);

        const x = this.offsetX + column * (this.tileWidth + this.spacing) + u * this.tileWidth;
        const y = this.offsetY + row * (this.tileHeight + this.spacing) + (1 - v) * this.tileHeight; // pixels from the top

        return [x / this.width, 1 - y / this.height];
    }

    /** a Lambert material using this atlas, set up for pixel-art tiles with transparency */
    createMaterial(params: MeshLambertMaterialParameters = {}): MeshLambertMaterial {
        return new MeshLambertMaterial({
            map: this.texture,
            alphaTest: 0.1,
            transparent: true,
            name: 'TextureAtlas',
            ...params,
        });
    }
}
