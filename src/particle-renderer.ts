import { Color } from './color';

/**
 * Double-buffered 2D canvas renderer built for per-pixel particle rendering
 * (draws into an `OffscreenCanvas` buffer, then blits it to the screen
 * canvas each frame) - distinct from {@link CanvasRenderer}, which is a
 * general-purpose shape/text drawing API. Used by {@link ParticleSystem2d}.
 */
export class Renderer {
    private _screenCanvas: HTMLCanvasElement;
    private _bufferCanvas: OffscreenCanvas;

    public screenContext: CanvasRenderingContext2D;
    public bufferContext: OffscreenCanvasRenderingContext2D;

    get width(): number { return this._screenCanvas.width; }
    get height(): number { return this._screenCanvas.height; }

    constructor(canvas?: HTMLCanvasElement) {
        this._screenCanvas = canvas ?? document.createElement('canvas');
        this._bufferCanvas = new OffscreenCanvas(this._screenCanvas.width, this._screenCanvas.height);

        this.screenContext = this._screenCanvas.getContext('2d')!;
        this.bufferContext = this._bufferCanvas.getContext('2d')!;

        if (!this.screenContext || !this.bufferContext) {
            throw 'Failed to create CanvasRenderingContext2D';
        }
    }

    /** Moves the screen canvas into `target` (detaching from any previous parent) and optionally resizes to fit. */
    appendTo(target: HTMLElement, autoResize: boolean = true): void {
        if (this._screenCanvas.parentNode) {
            this._screenCanvas.parentNode.removeChild(this._screenCanvas);
        }

        target.appendChild(this._screenCanvas);

        if (autoResize) {
            this.resize();
        }
    }

    /** Resizes both the screen and buffer canvases to match the parent's (or explicit) size. Returns whether a resize happened. */
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

    /** Draws a `size` x `size` square centered at `(x, y)` into the offscreen buffer (not yet visible until {@link render}). */
    setPixel(x: number, y: number, color: Color, size: number = 2): void {
        this.bufferContext.fillStyle = color.hexStr;
        this.bufferContext.fillRect(x - (size / 2), y - (size / 2), size, size);
    }

    /** Blits the offscreen buffer to the visible screen canvas and clears the buffer for the next frame. */
    render(): void {
        this.screenContext.clearRect(0, 0, this._screenCanvas.width, this._screenCanvas.height);
        this.screenContext.drawImage(this._bufferCanvas, 0, 0);
        this.bufferContext.clearRect(0, 0, this._screenCanvas.width, this._screenCanvas.height);
    }
}
