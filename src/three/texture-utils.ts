import { NearestFilter, RepeatWrapping, Texture, TextureLoader } from "three";

/**
 * A loaded texture with its image size, as returned by {@link LoadTexture}.
 *
 * @category Textures
 */
export interface TextureData {
    /** image width in pixels */
    width: number,
    /** image height in pixels */
    height: number,
    /** the loaded texture */
    texture: Texture<any>,
}

/**
 * Loads an image into a `Texture` with three's `TextureLoader`.
 *
 * @returns resolves once the image has loaded; rejects with the loader's error
 * @category Textures
 */
export function LoadTexture(url: string): Promise<TextureData> {
    return new Promise<TextureData>((res, rej) => {
        (new TextureLoader()).load(
            url,
            (texture: Texture<any>) => {
                const width = texture.source.data.width;
                const height = texture.source.data.height;
                res({ width, height, texture });
            },
            (_ev) => { },
            (err) => rej(err),
        );
    });
}

/**
 * A clone of `texture` showing only the rectangle at (x, y) of size w x h, in pixels with y measured
 * from the image's top, via `offset` / `repeat`. Sets `magFilter` to `NearestFilter` and `wrapS` / `wrapT`
 * to `RepeatWrapping`. The clone shares the source image, so no pixels are copied.
 *
 * @category Textures
 */
export function CreateSubTexture(
    texture: Texture,
    x: number, y: number,
    w: number, h: number,
): Texture {
    const subTexture = texture.clone();

    subTexture.magFilter = NearestFilter;
    subTexture.wrapS = RepeatWrapping;
    subTexture.wrapT = RepeatWrapping;

    w /= subTexture.width;
    h /= subTexture.height;

    x /= subTexture.width;
    y = (1 - h) - (y / subTexture.height);

    subTexture.offset.set(x, y);
    subTexture.repeat.set(w, h);

    subTexture.needsUpdate = true;

    return subTexture;
}
