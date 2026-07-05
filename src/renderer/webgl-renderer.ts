import { CreateWebGlContext, ProgramInfo } from './webgl';

/** Options for constructing a {@link WebGlRenderer}. Currently unused by the constructor itself - reserved for future configuration. */
export interface RendererParams {
    canvas?: HTMLCanvasElement,
    parent?: HTMLElement,
}

/**
 * Minimal raw-WebGL2 renderer wrapper: owns a canvas/context with depth
 * testing enabled and handles resizing. Lower-level than the `three/`
 * helpers - use this when working directly with `webgl.ts`'s shader/program
 * functions rather than Three.js.
 */
export class WebGlRenderer {
    public gl: WebGL2RenderingContext;

    public programInfo: ProgramInfo | undefined;

    public get canvas(): HTMLCanvasElement { return this.gl.canvas as HTMLCanvasElement; }
    public get width(): number { return this.gl.canvas.width; }
    public get height(): number { return this.gl.canvas.height; }

    constructor() {
        this.gl = CreateWebGlContext();

        this.gl.enable(this.gl.DEPTH_TEST);
    }

    /** Moves the canvas into `htmlElement` (detaching from any previous parent) and resizes to fit. */
    public appendTo(htmlElement?: HTMLElement) {
        if (this.canvas.parentElement) {
            this.canvas.parentElement.removeChild(this.canvas);
        }

        if (htmlElement) {
            htmlElement.appendChild(this.canvas);
            this.resize();
        }
    }

    /** Resizes the canvas backing store and GL viewport to match its parent's (or explicit) size. Returns whether a resize happened. */
    public resize(displayWidth?: number, displayHeight?: number): boolean {
        const { width, height } = (
            this.canvas.parentElement?.getBoundingClientRect() ??
            this.canvas.getBoundingClientRect()
        );

        displayWidth = (0 | (displayWidth ?? width));
        displayHeight = (0 | (displayHeight ?? height));

        if (this.width !== displayWidth || this.height !== displayHeight) {
            this.gl.canvas.width = displayWidth
            this.gl.canvas.height = displayHeight;
            this.gl.viewport(0, 0, displayWidth, displayHeight);
            return true;
        }

        return false;
    }

    /** Per-frame render hook. Currently a no-op stub - drawing logic is left to the consumer for now. */
    render(_deltaTime: number) {
        if (this.programInfo) {

        }
    }
}
