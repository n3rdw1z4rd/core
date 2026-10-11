import { Vector2, WebGLRenderer, type WebGLRendererParameters } from "three";

export class Renderer extends WebGLRenderer {
    private _size = new Vector2();

    get width(): number { return this.domElement.width; }
    get height(): number { return this.domElement.height; }
    get aspectRatio(): number { return this.width / this.height; }

    constructor(parameters?: WebGLRendererParameters) {
        super(parameters);

        this.setPixelRatio(window.devicePixelRatio);
    }

    resize(width?: number, height?: number): boolean {
        let resized = false;

        // compare in CSS pixels: domElement.width/height include the pixel ratio, which
        // made every call look like a size change on high-DPI displays
        const size = this.getSize(this._size);

        width = width ?? this.domElement.parentElement?.clientWidth ?? size.width;
        height = height ?? this.domElement.parentElement?.clientHeight ?? size.height;

        if (size.width !== width || size.height !== height) {
            this.setSize(width, height);
            resized = true;
        }

        return resized;
    }
}
