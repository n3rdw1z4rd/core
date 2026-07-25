import { abs, clamp, TAU, floor, PI, cos, sin, XYZ } from "../math";

export type CanvasColor = string | CanvasGradient | CanvasPattern;

export const DEFAULT_COLOR: CanvasColor = 'white';
export const DEFAULT_PIXEL_SIZE: number = 1;

export const DEFAULT_FONT = '18px monospace';
export const DEFAULT_TEXTALIGN = 'left';
export const DEFAULT_TEXTBASELINE = 'alphabetic';

export interface DrawParams {
    color?: CanvasColor,
    filled?: boolean,
    size?: number,
    lineDash?: number[],
}

export interface SpriteParams extends DrawParams {
    sourceX?: number,
    sourceY?: number,
    sourceWidth?: number,
    sourceHeight?: number,
}

export class CanvasRenderer {
    context: CanvasRenderingContext2D;

    get canvas(): HTMLCanvasElement { return this.context.canvas; }
    get width(): number { return this.canvas.width; }
    get height(): number { return this.canvas.height; }

    constructor(canvas?: HTMLCanvasElement) {
        this.context = (canvas ?? document.createElement('canvas'))
            .getContext('2d')!;

        this.context.font = DEFAULT_FONT;
        this.context.textAlign = DEFAULT_TEXTALIGN;
        this.context.textBaseline = DEFAULT_TEXTBASELINE;
    }

    resize(width?: number, height?: number): boolean {
        let resized = false;

        width = width ?? this.canvas.parentElement?.clientWidth ?? this.width;
        height = height ?? this.canvas.parentElement?.clientHeight ?? this.height;

        if (this.canvas.width != width || this.canvas.height != height) {
            this.canvas.width = width;
            this.canvas.height = height;
            resized = true;
        }

        return resized;
    }

    clear() {
        this.context.clearRect(0, 0, this.width, this.height);
    }

    render(callback: () => void, camera?: XYZ) {
        camera = camera ?? { x: 0, y: 0, z: 1 };

        this.clear();
        this.context.save();

        this.context.translate(this.width / 2, this.height / 2);
        this.context.scale(camera.z, camera.z);
        this.context.translate(-camera.x, -camera.y);

        callback();

        this.context.restore();
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
        this.context.stroke();

        if (params.filled) {
            this.context.fill();
        }

        if (params.lineDash) {
            this.context.setLineDash([]);
        }
    }

    drawRect(x: number, y: number, width: number, height: number, params: DrawParams = {}) {
        x -= (width / 2);
        y -= (height / 2);

        this.context.fillStyle = params.color ?? DEFAULT_COLOR;
        this.context.strokeStyle = params.color ?? DEFAULT_COLOR;
        this.context.lineWidth = params.size ?? 1;

        if (params.lineDash) {
            this.context.setLineDash(params.lineDash);
        }

        this.context.beginPath();

        this.context.strokeRect(x, y, width, height);

        if (params.filled) {
            this.context.fillRect(x, y, width, height);
        }

        if (params.lineDash) {
            this.context.setLineDash([]);
        }
    }

    drawPixel(x: number, y: number, params: DrawParams = {}) {
        const size = abs(params.size || DEFAULT_PIXEL_SIZE);

        this.drawRect(x, y, size, size, {
            ...params,
            filled: true,
        });
    }

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

    drawCircle(x: number, y: number, radius: number, params: DrawParams = {}) {
        this.drawPath(() => {
            this.context.arc(x, y, radius, 0, TAU);
        }, params);
    }

    drawPolygon(
        x: number,
        y: number,
        radius: number,
        sides: number,
        params: DrawParams = {}
    ) {
        sides = floor(clamp(sides, 3, 36));

        this.drawPath(() => {
            for (let i = 0; i < sides; i++) {
                const angle = (i / sides) * TAU - PI / 2;

                const px = x + cos(angle) * radius;
                const py = y + sin(angle) * radius;

                if (i === 0) {
                    this.context.moveTo(px, py);
                } else {
                    this.context.lineTo(px, py);
                }
            }

            this.context.closePath();
        }, params);
    }

    drawText(x: number, y: number, text: string, params: DrawParams = {}) {
        this.context.fillStyle = params.color ?? DEFAULT_COLOR;
        this.context.fillText(text, x, y);
    }

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
