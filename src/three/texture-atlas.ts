import { TextureLoader, Texture, MeshLambertMaterial, MeshLambertMaterialParameters, NearestFilter, RepeatWrapping } from 'three';

/** A loaded Three.js `Texture` plus its resolved pixel dimensions. */
export interface TextureData {
    width: number,
    height: number,
    texture: Texture,
}

/** Loads an image as a Three.js `Texture`, resolving with its pixel dimensions alongside it. */
export function LoadTexture(url: string): Promise<TextureData> {
    return new Promise<TextureData>((res, rej) => {
        (new TextureLoader()).load(
            url,
            (texture: Texture) => {
                const data = texture.source.data as { width: number, height: number };
                const width = data.width;
                const height = data.height;
                res({ width, height, texture });
            },
            (_ev) => { },
            (err) => rej(err),
        );
    });
}

/**
 * Clones `texture` and configures its `offset`/`repeat` to sample only the
 * `w` x `h` pixel region starting at `(x, y)` - i.e. a single sub-image
 * from a larger sprite sheet/atlas texture.
 */
export function CreateSubTexture(
    texture: Texture,
    x: number, y: number,
    w: number, h: number,
): Texture {
    texture = texture.clone();

    texture.magFilter = NearestFilter;
    texture.wrapS = RepeatWrapping;

    const data = texture.source.data as { width: number, height: number };
    const textureWidth: number = data.width;
    const textureHeight: number = data.height;

    w /= textureWidth;
    h /= textureHeight;

    x /= textureWidth;
    y = (1 - h) - (y / textureHeight);

    texture.offset.set(x, y);
    texture.repeat.set(w, h);

    texture.needsUpdate = true;

    return texture;
}

/**
 * A `MeshLambertMaterial` backed by a fixed-grid texture atlas: tiles are
 * addressed by a single `voxel` index along a uniform grid of
 * `textureWidth` x `textureHeight`-pixel cells. For pixel-based tile sizing
 * with an optional border/margin instead of a fixed grid divisor, see
 * {@link AtlasTextureMaterial}.
 */
export class TextureAtlas extends MeshLambertMaterial {
    private _uw: number;
    private _uh: number;

    constructor(
        public readonly textureData: TextureData,
        public readonly textureWidth: number,
        public readonly textureHeight: number = textureWidth,
        params?: MeshLambertMaterialParameters,
    ) {
        super({
            map: textureData.texture,
            alphaTest: 0.1,
            transparent: true,
            ...params ?? {},
        });

        this._uw = this.textureWidth / this.textureData.width;
        this._uh = this.textureHeight / this.textureData.height;

        this.textureData.texture.magFilter = NearestFilter;
    }

    /** Maps a tile index (`voxel`) and local UV (`ux`, `uy`, each 0-1 within the tile) to atlas-space UV coordinates. */
    getUv(voxel: number, ux: number, uy: number): [number, number] {
        return [
            (voxel + ux) * this._uw,
            1 - (1 - uy) * this._uh,
        ];
    }

    /** Loads a texture from `url` and builds a `TextureAtlas` from it. */
    public static CreateFromUrl(
        url: string,
        textureWidth: number,
        textureHeight: number = textureWidth,
        params?: MeshLambertMaterialParameters,
    ): Promise<TextureAtlas> {
        return LoadTexture(url).then((textureData: TextureData) => new TextureAtlas(
            textureData,
            textureWidth,
            textureHeight,
            params,
        ));
    }
}

/** Tile sizing/offset options for {@link AtlasTextureMaterial}, in source-texture pixels. */
export interface AtlasParams {
    tilePixelWidth?: number,
    tilePixelHeight?: number,
    /** Pixel offset into the source texture before the tile grid starts (e.g. for atlases with a border/margin). */
    tilePixelOffsetWidth?: number,
    tilePixelOffsetHeight?: number,
}

/** Standard `MeshLambertMaterial` constructor options, used as-is for {@link AtlasTextureMaterial}. */
export interface AtlasTextureMaterialParams extends MeshLambertMaterialParameters { }

/**
 * Alternate atlas material to {@link TextureAtlas}: computes per-tile UVs
 * from pixel-based tile dimensions instead of a fixed grid divisor, and
 * supports a pixel offset into the source texture (e.g. for atlases with a
 * border/margin).
 */
export class AtlasTextureMaterial extends MeshLambertMaterial {
    public readonly textureData: TextureData;

    public readonly tilePixelWidth: number;
    public readonly tilePixelHeight: number;

    private _tileCount: number;
    private _uvWidth: number;
    private _uvHeight: number;
    private _textureOffsetWidth: number;
    private _textureOffsetHeight: number;

    constructor(
        textureData: TextureData,
        atlasParams: AtlasParams = {},
        materialParams: AtlasTextureMaterialParams = {},
    ) {
        super({
            map: textureData.texture,
            alphaTest: 0.1,
            transparent: true,
            name: 'AtlasTextureMaterial',
            ...materialParams,
        });

        this.textureData = textureData;
        this.textureData.texture.magFilter = NearestFilter;

        this.tilePixelWidth = atlasParams.tilePixelWidth ?? 16;
        this.tilePixelHeight = atlasParams.tilePixelHeight ?? 16;

        this._textureOffsetWidth = atlasParams.tilePixelOffsetWidth ?? 0;
        this._textureOffsetHeight = atlasParams.tilePixelOffsetHeight ?? 0;

        this._tileCount = Math.floor(this.textureData.width / this.tilePixelWidth);

        this._uvWidth = this.tilePixelWidth / (this.textureData.width - this._textureOffsetWidth);
        this._uvHeight = this.tilePixelHeight / (this.textureData.height - this._textureOffsetHeight);
    }

    /** Maps a tile index and quad-corner index (`0`=bottom-left, `1`=bottom-right, `2`=top-left, `3`=top-right) to atlas-space UV coordinates. */
    getTileUVs(tileIndex: number, vertexIndex: number): [number, number] {
        const col = tileIndex % this._tileCount;
        const row = Math.floor(tileIndex / this._tileCount);

        const baseU = this._textureOffsetWidth / this.textureData.width + col * this._uvWidth;
        const baseV = this._textureOffsetHeight / this.textureData.height + row * this._uvHeight;

        const uvCorners: [number, number][] = [
            [0, 0], // bottom-left
            [1, 0], // bottom-right
            [0, 1], // top-left
            [1, 1], // top-right
        ];

        const [u, v] = uvCorners[vertexIndex];

        const uvx = baseU + u * this._uvWidth;
        const uvy = 1.0 - (baseV + v * this._uvHeight);

        return [uvx, uvy];
    }

    /** Loads a texture from `url` and builds an `AtlasTextureMaterial` from it. */
    public static fromUrl(
        url: string,
        atlasParams: AtlasParams = {},
        materialParams: AtlasTextureMaterialParams = {},
    ): Promise<AtlasTextureMaterial> {
        return LoadTexture(url).then((textureData: TextureData) => new AtlasTextureMaterial(
            textureData,
            atlasParams,
            materialParams,
        ));
    }
}
