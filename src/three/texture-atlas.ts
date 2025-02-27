import { vec2 } from 'gl-matrix';
import { TextureLoader, Texture, MeshLambertMaterial, MeshLambertMaterialParameters, NearestFilter } from 'three';

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
                const width = texture.source.data.width;
                const height = texture.source.data.height;
                res({ width, height, texture });
            },
            (_ev) => { },
            (err) => rej(err),
        );
    });
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
