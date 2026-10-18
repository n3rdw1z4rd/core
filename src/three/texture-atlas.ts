import { MeshLambertMaterial, type MeshLambertMaterialParameters, NearestFilter, type Texture } from 'three';
import { LoadTexture, type TextureData } from './texture-utils';

export type UV = [number, number];

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
 * for the common Lambert setup.
 */
export class TextureAtlas {
    readonly texture: Texture;

    /** texture size in pixels */
    readonly width: number;
    readonly height: number;

    readonly tileWidth: number;
    readonly tileHeight: number;
    readonly offsetX: number;
    readonly offsetY: number;
    readonly spacing: number;

    /** tiles per row */
    readonly columns: number;
    readonly rows: number;

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
