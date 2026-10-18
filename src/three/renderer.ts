import { Vector2, WebGLRenderer, type WebGLRendererParameters } from "three";

/**
 * `WebGLRenderer` that uses the device pixel ratio and can size itself to its parent element.
 *
 * ```ts
 * const renderer = new Renderer({ antialias: true });
 * container.appendChild(renderer.domElement);
 *
 * // each frame
 * if (renderer.resize()) {
 *     camera.aspect = renderer.aspectRatio;
 *     camera.updateProjectionMatrix();
 * }
 * renderer.render(scene, camera);
 * ```
 *
 * @category Rendering
 */
export class Renderer extends WebGLRenderer {
    private _size = new Vector2();

    /** CSS pixels, same as setSize() and resize(); domElement.width/height are CSS pixels * pixel ratio */
    get width(): number { return this.getSize(this._size).width; }
    /** CSS pixels */
    get height(): number { return this.getSize(this._size).height; }
    /** width / height (1 while the height is 0) */
    get aspectRatio(): number { return this.height > 0 ? this.width / this.height : 1; }

    constructor(parameters?: WebGLRendererParameters) {
        super(parameters);

        this.setPixelRatio(window.devicePixelRatio);
    }

    /**
     * Sets the size in CSS pixels, if it differs from the current one. A missing `width` / `height`
     * defaults to the parent element's client size (or the current size when there is no parent, or
     * the parent has no size yet, e.g. before layout or while hidden).
     *
     * @returns whether the size changed
     */
    resize(width?: number, height?: number): boolean {
        let resized = false;

        width = width ?? (this.domElement.parentElement?.clientWidth || this.width);
        height = height ?? (this.domElement.parentElement?.clientHeight || this.height);

        if (this.width !== width || this.height !== height) {
            this.setSize(width, height);
            resized = true;
        }

        return resized;
    }
}
