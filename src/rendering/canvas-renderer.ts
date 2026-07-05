export interface DrawParams {
    radius?: number,
    fill?: boolean,
    color?: string | CanvasGradient | CanvasPattern,
}

export class CanvasRenderer {
    ctx: CanvasRenderingContext2D;

    clearColor: string | CanvasGradient | CanvasPattern = '#000000';
    fontName: string = 'monospace';
    fontSize: number = 32;
    textAlign: CanvasTextAlign = 'center';
    textBaseline: CanvasTextBaseline = 'middle';

    get width(): number { return this.ctx?.canvas.width ?? 0; }
    get height(): number { return this.ctx?.canvas.height ?? 0; }
    get center(): [number, number] { return [this.width / 2, this.height / 2]; }

    constructor(canvas?: HTMLCanvasElement) {
        this.ctx = (canvas ?? document.createElement('canvas')).getContext('2d')!; // TODO should handle this better

        this.ctx.canvas.style.backgroundColor = '#000000';
        this.ctx.canvas.style.display = 'block';

        this.ctx.font = `${this.fontSize}px ${this.fontName}`;
        this.ctx.textAlign = this.textAlign;
        this.ctx.textBaseline = this.textBaseline;

        this.resize();
        this.clear();
    }

    appendTo(target?: HTMLElement, autoResize: boolean = true) {
        if (this.ctx.canvas.parentElement) {
            this.ctx.canvas.parentElement.removeChild(this.ctx.canvas);
        }

        if (target) {
            target.appendChild(this.ctx.canvas);

            if (autoResize) {
                this.resize();
            }
        }
    }

    resize(displayWidth?: number, displayHeight?: number): boolean {
        let resized = false;

        const { width, height } = (
            this.ctx.canvas.parentElement?.getBoundingClientRect() ??
            this.ctx.canvas.getBoundingClientRect()
        );

        displayWidth = (0 | (displayWidth ?? width));
        displayHeight = (0 | (displayHeight ?? height));


        if (this.width !== displayWidth || this.height !== displayHeight) {
            this.ctx.canvas.width = displayWidth;
            this.ctx.canvas.height = displayHeight;

            resized = true;
        }

        return resized;
    }

    clear() {
        this.ctx?.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
    }

    drawPoint(xy: [number, number], params: DrawParams = {}) {
        const [x, y] = xy;

        const radius = params.radius || 1;
        const fill = params.fill !== false;
        const color = params.color || '#000000';

        this.ctx.fillStyle = color;
        this.ctx.strokeStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
        this.ctx[fill ? 'fill' : 'stroke']();
    }

    drawBox(xy: [number, number], wh: [number, number], params: DrawParams = {}) {
        const [x, y] = xy;
        const [w, h] = wh;

        const fill = params.fill !== false;
        const color = params.color || '#000000';

        this.ctx.fillStyle = color;
        this.ctx.strokeStyle = color;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(x + w, y);
        this.ctx.lineTo(x + w, y + h);
        this.ctx.lineTo(x, y + h);
        this.ctx.closePath();
        this.ctx[fill ? 'fill' : 'stroke']();
    }

    drawLine(x1y1x2y2: [number, number, number, number], color = '#000000') {
        const [x1, y1, x2, y2] = x1y1x2y2;

        this.ctx.strokeStyle = color;
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
    }

    drawText(
        text: string,
        xy: [number, number],
        color = '#ffffff',
        size = this.fontSize,
        font = this.fontName
    ) {
        const [x, y] = xy;

        this.ctx.fillStyle = color;
        this.ctx.font = `${size}px ${font}`;
        this.ctx.textAlign = this.textAlign;
        this.ctx.textBaseline = this.textBaseline;
        this.ctx.fillText(text, x, y + 0.5);
    }
}
