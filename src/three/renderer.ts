import { WebGLRenderer, type WebGLRendererParameters } from "three";

export class Renderer extends WebGLRenderer {
    get width(): number { return this.domElement.width; }
    get height(): number { return this.domElement.height; }
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
