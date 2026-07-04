import { vec2 } from 'gl-matrix';
import { TextureLoader, Texture, MeshLambertMaterial, MeshLambertMaterialParameters, NearestFilter, RepeatWrapping } from 'three';

export interface TextureData {
    width: number,
    height: number,
    texture: Texture,
}

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

    getUv(voxel: number, ux: number, uy: number): vec2 {
        return vec2.fromValues(
            (voxel + ux) * this._uw,
            1 - (1 - uy) * this._uh,
        );
    }

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

export interface AtlasParams {
    tilePixelWidth?: number,
    tilePixelHeight?: number,
    tilePixelOffsetWidth?: number,
    tilePixelOffsetHeight?: number,
}

export interface AtlasTextureMaterialParams extends MeshLambertMaterialParameters { }

// Alternate atlas material to TextureAtlas above: computes per-tile UVs from
// pixel-based tile dimensions instead of a fixed grid divisor, and supports a
// pixel offset into the source texture (e.g. for atlases with a border/margin).
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
