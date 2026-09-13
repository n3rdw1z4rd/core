import { MeshLambertMaterial, type MeshLambertMaterialParameters, NearestFilter } from 'three';
import { LoadTexture, type TextureData } from './texture-utils';

export type UV = [number, number];

export interface AltasParams {
    tilePixelWidth?: number,
    tilePixelHeight?: number,
    tilePixelOffsetWidth?: number,
    tilePixelOffsetHeight?: number,
}

export interface AtlasTextureMaterialParams extends MeshLambertMaterialParameters { }

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
        atlasParams: AltasParams = {},
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
        atlasParams: AltasParams = {},
        materialParams: AtlasTextureMaterialParams = {},
    ): Promise<AtlasTextureMaterial> {
        return LoadTexture(url).then((textureData: TextureData) => new AtlasTextureMaterial(
            textureData,
            atlasParams,
            materialParams,
        ));
    }
}
