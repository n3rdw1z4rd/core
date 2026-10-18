import { Observable } from './observable';
import {
    BindRenderTarget, CreateProgramInfo, CreateWebGlContext, Draw, type DrawOptions, type ProgramInfo,
    type RenderTarget, ResizeWebGlContext, type VertexArrayInfo,
} from './webgl';

/**
 * Options for the {@link WebGlRenderer} constructor.
 *
 * @category WebGL
 */
export interface RendererParams {
    /** default: a new canvas */
    canvas?: HTMLCanvasElement,
    /** append the canvas here (and size it to the parent) */
    parent?: HTMLElement,
    /** antialias, alpha, preserveDrawingBuffer, ... */
    attributes?: WebGLContextAttributes,
    /** default: window.devicePixelRatio */
    pixelRatio?: number,
}

/**
 * A thin owner of a WebGL2 context: sizing (CSS pixels x pixel ratio), clearing, render targets,
 * drawing, and context-loss notifications. Everything else is the webgl.ts wrappers on `gl`.
 * There is no render loop and no resource tracking: run your own loop (e.g. with Clock) and
 * delete what you create.
 *
 * ```ts
 * const renderer = new WebGlRenderer({ parent: document.body });
 * const program = renderer.createProgram(vertexSource, fragmentSource);
 * const quad = CreateVertexArray(renderer.gl, program, {
 *     aPosition: { buffer: CreateBuffer(renderer.gl, [-1, -1, 1, -1, -1, 1, 1, 1]), size: 2 },
 * });
 *
 * new Clock().start((dt, time) => {
 *     renderer.clear();
 *     renderer.draw(program, quad, { mode: renderer.gl.TRIANGLE_STRIP, count: 4, uniforms: { uTime: time } });
 * });
 * ```
 *
 * @category WebGL
 */
export class WebGlRenderer {
    /** the WebGL2 context; use it with the {@link CreateBuffer}, {@link CreateTexture}, ... helpers */
    readonly gl: WebGL2RenderingContext;

    /** drawing buffer pixels per CSS pixel; applied on the next `resize()` */
    pixelRatio: number;

    /**
     * The GPU context was lost (driver reset, too many contexts, ...): every program, buffer and
     * texture is gone. Stop drawing until onContextRestored, then recreate your resources.
     */
    readonly onContextLost = new Observable<void>();
    /** The GPU context is back after {@link WebGlRenderer.onContextLost}: recreate programs, buffers and textures. */
    readonly onContextRestored = new Observable<void>();

    private _width = 0;   // CSS pixels
    private _height = 0;
    private readonly _listeners: [string, EventListener][] = [];

    /** the canvas the context draws on */
    get canvas(): HTMLCanvasElement { return this.gl.canvas as HTMLCanvasElement; }

    /** Size in CSS pixels (the drawing buffer is this times `pixelRatio`). */
    get width(): number { return this._width; }
    /** Height in CSS pixels. */
    get height(): number { return this._height; }
    /** `width / height`, or 1 while the height is 0 */
    get aspectRatio(): number { return this._height > 0 ? this._width / this._height : 1; }

    /** whether the GPU context is currently lost (`draw()` does nothing meanwhile) */
    get isContextLost(): boolean { return this.gl.isContextLost(); }

    /** Creates the context (throws without WebGL2), enables depth testing, and appends to `params.parent` if given. */
    constructor(params: RendererParams = {}) {
        this.gl = CreateWebGlContext(params.canvas, params.attributes);
        this.pixelRatio = params.pixelRatio ?? globalThis.devicePixelRatio ?? 1;

        this._width = this.canvas.width / this.pixelRatio;
        this._height = this.canvas.height / this.pixelRatio;

        this.gl.enable(this.gl.DEPTH_TEST);

        this._listen('webglcontextlost', (event) => {
            event.preventDefault(); // allows the browser to restore the context
            this.onContextLost.notify();
        });

        this._listen('webglcontextrestored', () => {
            this.gl.enable(this.gl.DEPTH_TEST);
            this.onContextRestored.notify();
        });

        if (params.parent) this.appendTo(params.parent);
    }

    /** Moves the canvas into `element` (or out of the page, without one) and resizes to fit. */
    appendTo(element?: HTMLElement): void {
        this.canvas.remove();

        if (element) {
            element.appendChild(this.canvas);
            this.resize();
        }
    }

    /**
     * Sizes the canvas to `width` x `height` CSS pixels (default: its parent's size); the drawing
     * buffer gets the pixel ratio applied. Returns whether anything changed.
     */
    resize(width?: number, height?: number): boolean {
        if (width === undefined || height === undefined) {
            const rect = this.canvas.parentElement?.getBoundingClientRect() ?? this.canvas.getBoundingClientRect();

            width ??= rect.width;
            height ??= rect.height;
        }

        const changed = width !== this._width || height !== this._height;

        this._width = width;
        this._height = height;

        // the element shows at CSS size; the buffer behind it is pixelRatio times larger
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;

        return ResizeWebGlContext(this.gl, width, height, this.pixelRatio) || changed;
    }

    /**
     * Clears the bound target to `color` (RGBA in 0..1, alpha default 1) and, with `depth`
     * (default true), also the depth and stencil buffers.
     */
    clear(color: ArrayLike<number> = [0, 0, 0, 1], depth = true): void {
        const gl = this.gl;

        gl.clearColor(color[0], color[1], color[2], color[3] ?? 1);
        gl.clear(gl.COLOR_BUFFER_BIT | (depth ? gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT : 0));
    }

    /** Draws into `target`, or the canvas with null. */
    setRenderTarget(target: RenderTarget | null): void {
        BindRenderTarget(this.gl, target);
    }

    /** Compiles and links a program and collects its attributes and uniforms ({@link CreateProgramInfo}). Throws on errors. */
    createProgram(vertexShaderSource: string, fragmentShaderSource: string): ProgramInfo {
        return CreateProgramInfo(this.gl, vertexShaderSource, fragmentShaderSource);
    }

    /** Draws with {@link Draw}; skipped while the context is lost. */
    draw(info: ProgramInfo, vertexArray: VertexArrayInfo, options?: DrawOptions): void {
        if (this.isContextLost) return;

        Draw(this.gl, info, vertexArray, options);
    }

    /** Removes the renderer's event listeners. GPU resources you created are yours to delete. */
    dispose(): void {
        for (const [type, listener] of this._listeners) this.canvas.removeEventListener(type, listener);

        this._listeners.length = 0;
    }

    private _listen(type: string, listener: EventListener): void {
        this.canvas.addEventListener(type, listener);
        this._listeners.push([type, listener]);
    }
}
