import { Color } from './color';

/**
 * Double-buffered square-pixel renderer for particle effects: draw with `setPixel()` into an
 * offscreen buffer, then `render()` copies the buffer to the visible canvas and clears it.
 * Requires `OffscreenCanvas`. Used by {@link ParticleSystem2d}.
 *
 * ```ts
 * const renderer = new ParticleRenderer();
 * renderer.appendTo(document.body);
 *
 * renderer.setPixel(10, 10, Color.RED);
 * renderer.render();
 * ```
 *
 * @category Canvas 2D
 */
export class ParticleRenderer {
    private _screenCanvas: HTMLCanvasElement;
    private _bufferCanvas: OffscreenCanvas;

    /** context of the visible canvas */
    public screenContext: CanvasRenderingContext2D;
    /** context of the offscreen buffer that `setPixel()` draws into */
    public bufferContext: OffscreenCanvasRenderingContext2D;

    /** canvas width in pixels */
    get width(): number { return this._screenCanvas.width; }
    /** canvas height in pixels */
    get height(): number { return this._screenCanvas.height; }

    /**
     * @param canvas the visible canvas; defaults to a new canvas element, not attached to the page
     * @throws an `Error` if a 2D context can't be created
     */
    constructor(canvas?: HTMLCanvasElement) {
        this._screenCanvas = canvas ?? document.createElement('canvas');
        this._bufferCanvas = new OffscreenCanvas(this._screenCanvas.width, this._screenCanvas.height);

        const screenContext = this._screenCanvas.getContext('2d');
        const bufferContext = this._bufferCanvas.getContext('2d');

        if (!screenContext || !bufferContext) {
            throw new Error('ParticleRenderer: failed to create CanvasRenderingContext2D');
        }

        this.screenContext = screenContext;
        this.bufferContext = bufferContext;
    }

    /** Moves the canvas into `target` and, with `autoResize` (default true), resizes it to fit. */
    appendTo(target: HTMLElement, autoResize: boolean = true): void {
        if (this._screenCanvas.parentNode) {
            this._screenCanvas.parentNode.removeChild(this._screenCanvas);
        }

        target.appendChild(this._screenCanvas);

        if (autoResize) {
            this.resize();
        }
    }

    /**
     * Sets the canvas and buffer size in pixels (truncated to integers). A missing dimension
     * defaults to the parent element's size (or the canvas's own size on the page). Resizing
     * clears the buffer. Returns whether the size changed.
     */
    resize(displayWidth?: number, displayHeight?: number): boolean {
        const { width, height } = (
            this._screenCanvas.parentElement?.getBoundingClientRect() ??
            this._screenCanvas.getBoundingClientRect()
        );

        displayWidth = (0 | (displayWidth ?? width));
        displayHeight = (0 | (displayHeight ?? height));

        if (this._screenCanvas.width !== displayWidth || this._screenCanvas.height !== displayHeight) {
            this._screenCanvas.width = displayWidth
            this._screenCanvas.height = displayHeight;

            this._bufferCanvas.width = displayWidth;
            this._bufferCanvas.height = displayHeight;

            return true;
        }

        return false;
    }

    /** Draws a filled `size` x `size` square (pixels, default 2) centered on (`x`, `y`) into the buffer. */
    setPixel(x: number, y: number, color: Color, size: number = 2): void {
        this.bufferContext.fillStyle = color.hexStr;
        this.bufferContext.fillRect(x - (size / 2), y - (size / 2), size, size);
    }

    /** Replaces the visible canvas with the buffer's contents, then clears the buffer for the next frame. */
    render(): void {
        this.screenContext.clearRect(0, 0, this._screenCanvas.width, this._screenCanvas.height);
        this.screenContext.drawImage(this._bufferCanvas, 0, 0);
        this.bufferContext.clearRect(0, 0, this._screenCanvas.width, this._screenCanvas.height);
    }
}
