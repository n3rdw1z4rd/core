import { abs, PI } from "../math";

export type CanvasColor = string | CanvasGradient | CanvasPattern;

export interface DrawParams {
    color?: CanvasColor,
    strokeColor?: CanvasColor,
    fillColor?: CanvasColor,
    filled?: boolean,
    size?: number,
    fontName?: string,
    textAlign?: CanvasTextAlign,
    textBaseline?: CanvasTextBaseline,
    lineDash?: number[],
}

export class CanvasRenderer {
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D;

    drawCentered: boolean = true;

    get width(): number { return this.context.canvas.width; }
    get height(): number { return this.context.canvas.height; }

    constructor(canvas?: HTMLCanvasElement) {
        this.canvas = canvas ?? document.createElement('canvas');
        this.context = this.canvas.getContext('2d')!;
    }

    appendTo(target: HTMLElement): void {
        if (this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }

        target.appendChild(this.canvas);
    }

    resize(displayWidth?: number, displayHeight?: number): boolean {
        const { width, height } = (
            this.canvas.parentElement?.getBoundingClientRect() ??
            this.canvas.getBoundingClientRect()
        );

        displayWidth = (0 | (displayWidth ?? width));
        displayHeight = (0 | (displayHeight ?? height));

        if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
            this.canvas.width = displayWidth
            this.canvas.height = displayHeight;

            return true;
        }

        return false;
    }

    clear() {
        this.context.clearRect(0, 0, this.width, this.height);
    }

    drawRect(x: number, y: number, width: number, height: number, params: DrawParams = {}) {
        if (this.drawCentered) {
            x -= (width / 2);
            y -= (height / 2);
        }

        this.context.strokeStyle = params.strokeColor ?? params.color ?? 'white';
        this.context.fillStyle = params.fillColor ?? params.color ?? 'white';
        this.context.lineWidth = params.size ?? 1;

        if (params.lineDash) {
            this.context.setLineDash(params.lineDash);
        }

        this.context.beginPath();

        if (params.filled === true) {
            this.context.fillRect(x, y, width, height);

            if (params.strokeColor !== undefined) this.context.strokeRect(x, y, width, height);
        } else {
            this.context.strokeRect(x, y, width, height);
        }

        if (params.lineDash) {
            this.context.setLineDash([]);
        }
    }

    drawPixel(x: number, y: number, params: DrawParams = {}) {
        const size = abs(params.size || 1);

        this.drawRect(x, y, size, size, {
            ...params,
            filled: true,
        });
    }

    drawLine(x1: number, y1: number, x2: number, y2: number, params: DrawParams = {}) {
        this.context.strokeStyle = params.color ?? 'white';
        this.context.lineWidth = params.size ?? 1;

        if (params.lineDash) {
            this.context.setLineDash(params.lineDash);
        }

        this.context.beginPath();
        this.context.moveTo(x1, y1);
        this.context.lineTo(x2, y2);
        // this.context.closePath(); // TODO: do i need this?
        this.context.stroke();

        if (params.lineDash) {
            this.context.setLineDash([]);
        }
    }

    drawCircle(x: number, y: number, radius: number, params: DrawParams = {}) {
        this.context.strokeStyle = params.strokeColor ?? params.color ?? 'white';
        this.context.fillStyle = params.fillColor ?? params.color ?? 'white';
        this.context.lineWidth = params.size ?? 1;

        if (params.lineDash) {
            this.context.setLineDash(params.lineDash);
        }

        this.context.beginPath();
        this.context.arc(x, y, radius, 0, 2 * PI);

        if (params.filled === true) this.context.fill();

        this.context.stroke();

        if (params.lineDash) {
            this.context.setLineDash([]);
        }
    }

    drawText(x: number, y: number, text: string, params: DrawParams = {}) {
        this.context.font = `${params.size ?? 14}px ${params.fontName ?? 'monospace'}`;
        this.context.textAlign = params.textAlign ?? 'left';
        this.context.textBaseline = params.textBaseline ?? 'alphabetic';
        this.context.fillStyle = params.color ?? 'white';

        this.context.fillText(text, x, y);
    }
}
