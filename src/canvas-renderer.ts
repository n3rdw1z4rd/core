import { clamp, TAU, PI } from "./math";
import { XY } from "./types";

/**
 * Anything a 2D context accepts as a fill or stroke style: a CSS color string, a gradient or a pattern.
 *
 * @category Canvas 2D
 */
export type CanvasColor = string | CanvasGradient | CanvasPattern;

/**
 * Fill / stroke color used when {@link DrawParams.color} is not given.
 *
 * @category Canvas 2D
 */
export const DEFAULT_COLOR: CanvasColor = 'white';
/**
 * Side length in pixels of {@link CanvasRenderer.drawPixel} when {@link DrawParams.size} is not given.
 *
 * @category Canvas 2D
 */
export const DEFAULT_PIXEL_SIZE: number = 1;
/**
 * Font size in pixels for {@link CanvasRenderer.drawText}.
 *
 * @category Canvas 2D
 */
export const DEFAULT_FONT_SIZE = 14;
/**
 * Font family for {@link CanvasRenderer.drawText}.
 *
 * @category Canvas 2D
 */
export const DEFAULT_FONT_NAME = 'monospace';
/**
 * CSS font built from {@link DEFAULT_FONT_SIZE} and {@link DEFAULT_FONT_NAME} (`'14px monospace'`).
 *
 * @category Canvas 2D
 */
export const DEFAULT_FONT = `${DEFAULT_FONT_SIZE}px ${DEFAULT_FONT_NAME}`;
/**
 * Default `textAlign` for {@link CanvasRenderer.drawText}.
 *
 * @category Canvas 2D
 */
export const DEFAULT_TEXTALIGN = 'left';
/**
 * Default `textBaseline` for {@link CanvasRenderer.drawText}.
 *
 * @category Canvas 2D
 */
export const DEFAULT_TEXTBASELINE = 'alphabetic';

/**
 * Optional style settings for the {@link CanvasRenderer} draw methods. Each method uses only the fields that apply to it.
 *
 * @category Canvas 2D
 */
export interface DrawParams {
    /** fill and stroke color, default {@link DEFAULT_COLOR} */
    color?: CanvasColor,
    /** shapes: fill instead of stroking the outline, default false */
    filled?: boolean,
    /** pixels: line width for outlines and lines (default 1), side length for drawPixel (default {@link DEFAULT_PIXEL_SIZE}), font size for drawText (default {@link DEFAULT_FONT_SIZE}) */
    size?: number,
    /** shapes and lines: dash pattern (see `setLineDash`), reset after drawing; default solid */
    lineDash?: number[],
    /** text: default {@link DEFAULT_TEXTALIGN} */
    textAlign?: CanvasTextAlign,
    /** text: default {@link DEFAULT_TEXTBASELINE} */
    textBaseline?: CanvasTextBaseline,
    /** text: a full CSS font; overrides `size` and `fontName` */
    font?: string,
    /** text: font family, default {@link DEFAULT_FONT_NAME} */
    fontName?: string,
}

/**
 * Parameters for {@link CanvasRenderer.drawSprite}: an optional source rectangle within the image (for sprite sheets). The rectangle is used only when both `sourceWidth` and `sourceHeight` are set; otherwise the whole image is drawn. The inherited style fields are ignored.
 *
 * @category Canvas 2D
 */
export interface SpriteParams extends DrawParams {
    /** pixels, default 0 */
    sourceX?: number,
    /** pixels, default 0 */
    sourceY?: number,
    /** pixels */
    sourceWidth?: number,
    /** pixels */
    sourceHeight?: number,
}

/**
 * Immediate-mode drawing of simple shapes, text and sprites on a 2D canvas. Rectangles, pixels and
 * sprites are positioned by their center; circles and polygons by their center and radius.
 *
 * ```ts
 * const renderer = new CanvasRenderer();
 * document.body.appendChild(renderer.canvas);
 * renderer.resize(); // to the parent's size
 *
 * renderer.clear();
 * renderer.drawCircle(100, 100, 20, { color: 'red', filled: true });
 * renderer.drawText(10, 20, 'hello', { size: 16 });
 * ```
 *
 * @category Canvas 2D
 */
export class CanvasRenderer {
    /** the 2D context all drawing goes through */
    context: CanvasRenderingContext2D;

    /** the canvas being drawn on */
    get canvas(): HTMLCanvasElement { return this.context.canvas; }

    /** canvas width in pixels */
    get width(): number { return this.canvas.width; }

    /** canvas height in pixels */
    get height(): number { return this.canvas.height; }

    /** canvas center in pixels */
    get center(): XY { return { x: Math.floor(this.width / 2), y: Math.floor(this.height / 2) } }

    /**
     * @param canvas defaults to a new canvas element, not attached to the page (append {@link CanvasRenderer.canvas} yourself)
     */
    constructor(canvas?: HTMLCanvasElement) {
        this.context = (canvas ?? document.createElement('canvas'))
            .getContext('2d')!;

        this._applyDefaults();
    }

    // canvas resizes reset the context state, so this runs again after each one
    private _applyDefaults(): void {
        this.context.font = DEFAULT_FONT;
        this.context.textAlign = DEFAULT_TEXTALIGN;
        this.context.textBaseline = DEFAULT_TEXTBASELINE;
    }

    /**
     * Sets the canvas size in pixels; a missing dimension defaults to the parent element's client
     * size (or the current size without a parent, or while the parent has no size). Resizing clears
     * the canvas and resets the context state; the renderer's default font and alignment are
     * applied again. Returns whether the size changed.
     */
    resize(width?: number, height?: number): boolean {
        let resized = false;

        width = width ?? (this.canvas.parentElement?.clientWidth || this.width);
        height = height ?? (this.canvas.parentElement?.clientHeight || this.height);

        if (this.canvas.width != width || this.canvas.height != height) {
            this.canvas.width = width;
            this.canvas.height = height;
            this._applyDefaults();
            resized = true;
        }

        return resized;
    }

    /** Clears the whole canvas to transparent. */
    clear() {
        this.context.clearRect(0, 0, this.width, this.height);
    }

    private drawPath(buildPath: () => void, params: DrawParams = {}) {
        this.context.fillStyle = params.color ?? DEFAULT_COLOR;
        this.context.strokeStyle = params.color ?? DEFAULT_COLOR;
        this.context.lineWidth = params.size ?? 1;

        if (params.lineDash) {
            this.context.setLineDash(params.lineDash);
        }

        this.context.beginPath();
        buildPath();

        if (params.filled) {
            this.context.fill();
        } else {
            this.context.stroke();
        }

        if (params.lineDash) {
            this.context.setLineDash([]);
        }
    }

    /** Draws a `width` x `height` rectangle centered on (`x`, `y`): its outline, or filled with `filled`. */
    drawRect(x: number, y: number, width: number, height: number, params: DrawParams = {}) {
        x -= (width / 2);
        y -= (height / 2);

        this.context.fillStyle = params.color ?? DEFAULT_COLOR;
        this.context.strokeStyle = params.color ?? DEFAULT_COLOR;
        this.context.lineWidth = params.size ?? 1;

        if (params.lineDash) {
            this.context.setLineDash(params.lineDash);
        }

        if (params.filled) {
            this.context.fillRect(x, y, width, height);
        } else {
            this.context.strokeRect(x, y, width, height);
        }

        if (params.lineDash) {
            this.context.setLineDash([]);
        }
    }

    /** Draws a filled square of side `params.size` (default {@link DEFAULT_PIXEL_SIZE}) centered on (`x`, `y`). */
    drawPixel(x: number, y: number, params: DrawParams = {}) {
        const size = Math.abs(params.size ?? DEFAULT_PIXEL_SIZE);

        this.drawRect(x, y, size, size, {
            ...params,
            filled: true,
        });
    }

    /** Draws a line segment from (`x1`, `y1`) to (`x2`, `y2`); `params.size` is the line width. */
    drawLine(x1: number, y1: number, x2: number, y2: number, params: DrawParams = {}) {
        this.context.strokeStyle = params.color ?? DEFAULT_COLOR;
        this.context.lineWidth = params.size ?? 1;

        if (params.lineDash) {
            this.context.setLineDash(params.lineDash);
        }

        this.context.beginPath();
        this.context.moveTo(x1, y1);
        this.context.lineTo(x2, y2);
        this.context.stroke();

        if (params.lineDash) {
            this.context.setLineDash([]);
        }
    }

    /** Draws a circle centered on (`x`, `y`). */
    drawCircle(x: number, y: number, radius: number, params: DrawParams = {}) {
        this.drawPath(() => {
            this.context.arc(x, y, radius, 0, TAU);
        }, params);
    }

    /**
     * Draws a regular polygon centered on (`x`, `y`) with its first vertex straight up.
     *
     * @param radius distance from the center to each vertex
     * @param sides floored and clamped to 3..36
     */
    drawPolygon(
        x: number,
        y: number,
        radius: number,
        sides: number,
        params: DrawParams = {}
    ) {
        sides = Math.floor(clamp(sides, 3, 36));

        this.drawPath(() => {
            for (let i = 0; i < sides; i++) {
                const angle = (i / sides) * TAU - PI / 2;

                const px = x + Math.cos(angle) * radius;
                const py = y + Math.sin(angle) * radius;

                if (i === 0) {
                    this.context.moveTo(px, py);
                } else {
                    this.context.lineTo(px, py);
                }
            }

            this.context.closePath();
        }, params);
    }

    /**
     * Fills `text` at (`x`, `y`), aligned by `params.textAlign` / `params.textBaseline` (default
     * left / alphabetic). The font is `params.font`, or `params.size` px `params.fontName`.
     */
    drawText(x: number, y: number, text: string, params: DrawParams = {}) {
        this.context.font = params.font ??
            `${params.size ?? DEFAULT_FONT_SIZE}px ${params.fontName ?? DEFAULT_FONT_NAME}`;

        this.context.textAlign = params.textAlign ?? DEFAULT_TEXTALIGN;
        this.context.textBaseline = params.textBaseline ?? DEFAULT_TEXTBASELINE;
        this.context.fillStyle = params.color ?? DEFAULT_COLOR;
        this.context.fillText(text, x, y);
    }

    /**
     * Draws `image` (or the `params` source rectangle of it) scaled to `width` x `height`, centered
     * on (`x`, `y`).
     */
    drawSprite(
        x: number,
        y: number,
        image: CanvasImageSource,
        width: number,
        height: number,
        params: SpriteParams = {}
    ) {
        x -= (width / 2);
        y -= (height / 2);

        if (params.sourceWidth !== undefined && params.sourceHeight !== undefined) {
            this.context.drawImage(
                image,
                params.sourceX ?? 0,
                params.sourceY ?? 0,
                params.sourceWidth,
                params.sourceHeight,
                x, y, width, height,
            );
        } else {
            this.context.drawImage(image, x, y, width, height);
        }
    }
}
