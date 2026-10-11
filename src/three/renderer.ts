import { Vector2, WebGLRenderer, type WebGLRendererParameters } from "three";

export class Renderer extends WebGLRenderer {
    private _size = new Vector2();

    // CSS pixels, same as setSize() and resize(); domElement.width/height are CSS pixels * pixel ratio
    get width(): number { return this.getSize(this._size).width; }
    get height(): number { return this.getSize(this._size).height; }
    get aspectRatio(): number { return this.width / this.height; }

    constructor(parameters?: WebGLRendererParameters) {
        super(parameters);

        this.setPixelRatio(window.devicePixelRatio);
    }

    resize(width?: number, height?: number): boolean {
        let resized = false;

        width = width ?? this.domElement.parentElement?.clientWidth ?? this.width;
        height = height ?? this.domElement.parentElement?.clientHeight ?? this.height;

        if (this.width !== width || this.height !== height) {
            this.setSize(width, height);
            resized = true;
        }

        return resized;
    }
}
