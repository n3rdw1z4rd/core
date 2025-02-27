import { vec2, vec4 } from 'gl-matrix';

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
    get center(): vec2 { return vec2.fromValues(this.width / 2, this.height / 2); }

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

    drawPoint(xy: vec2, params: DrawParams = {}) {
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

    drawBox(xy: vec2, wh: vec2, params: DrawParams = {}) {
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

    drawLine(x1y1x2y2: vec4, color = '#000000') {
        const [x1, y1, x2, y2] = x1y1x2y2;

        this.ctx.strokeStyle = color;
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
    }

    drawText(
        text: string,
        xy: vec2,
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

    // drawNamePlate(name: string, title: string, color = '#bbbbbb', s: number = 12, tile_size: number = 32) {
    //     let x = (actor.position.x * tile_size);
    //     let y = (actor.position.y * tile_size) - 18;

    //     let healthPercent = (actor.health / actor.maxHealth);
    //     let healthBarWidth = (healthPercent * tile_size)
    //     let healthColor = getRedYellowGreenGradientHex(actor.health, actor.maxHealth);

    //     this.drawBox(x, y, tile_size, 3, { fill: true, color: '#666666' });
    //     this.drawBox(x, y, healthBarWidth, 3, { fill: true, color: healthColor });

    //     if (actor.title) {
    //         this.drawBox(x, y - 16, actor.name.length * (this.fontSize / 5), 10, { fill: true, color: '#000000' });
    //         this.drawText(actor.name || '', x, y - 16, color, s);

    //         this.drawBox(x, y - 7, actor.title.length * (this.fontSize / 5), 10, { fill: true, color: '#000000' });
    //         this.drawText(`<${actor.title}>`, x, y - 6, '#00FFFF', s);
    //     } else {
    //         this.drawBox(x, y - 6, actor.name.length * (this.fontSize / 5), 10, { fill: true, color: '#000000' });
    //         this.drawText(actor.name || '', x, y - 6, color, s);
    //     }
    // }
}
