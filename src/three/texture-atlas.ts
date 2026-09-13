import { MeshLambertMaterial, MeshLambertMaterialParameters, NearestFilter } from 'three';
import { LoadTexture, TextureData } from './texture-utils';

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

    getUv(voxel: number, ux: number, uy: number): [number, number] {
        return [
            (voxel + ux) * this._uw,
            1 - (1 - uy) * this._uh,
        ];
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
