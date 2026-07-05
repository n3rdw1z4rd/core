import { logwrn } from './logger';
import { clamp } from './math';

export class Color {
    private _hex: string = '#ffffffff';
    private _r: number = 255;
    private _g: number = 255;
    private _b: number = 255;
    private _a: number = 255;

    public get r(): number { return this._r; }
    public set r(value: number) {
        this._r = clamp(value, 0, 255);
        this._hex = this._to_hex();
    }

    public get g(): number { return this._g; }
    public set g(value: number) {
        this._g = clamp(value, 0, 255);
        this._hex = this._to_hex();
    }

    public get b(): number { return this._b; }
    public set b(value: number) {
        this._b = clamp(value, 0, 255);
        this._hex = this._to_hex();
    }

    public get a(): number { return this._a; }
    public set a(value: number) {
        this._a = clamp(value, 0, 255);
        this._hex = this._to_hex();
    }

    public get hexStr(): string { return this._hex; }
    public set hexStr(value: string) {
        if (value.startsWith('#')) {
            [this._r, this._g, this._b, this._a] = this._parse_hex_color_string(value);
            this._hex = value;
        } else {
            logwrn(`Color: invalid color string: ${value}. Should be a hexadecimal color string (i.e.: '#ffffff' or '#ffffffff'). Keeping the current color.`);
        }
    }

    public get rgba(): number[] { return [this._r, this._g, this._b, this._a]; }

    constructor(r: string | number = 255, g: number = 255, b: number = 255, a: number = 255) {
        if (typeof r === 'string') {
            if (r.startsWith('#')) {
                [r, g, b, a] = this._parse_hex_color_string(r);
            } else {
                logwrn(`Color: invalid color string: ${r}. Should be a hexadecimal color string (i.e.: '#ffffff' or '#ffffffff'). Defaulting to opaque white.`);
                r = g = b = a = 255;
            }
        } else {
            [r, g, b, a] = [r, g, b, a].map(n => Color._normalize(n));
        }

        this.r = r as number;
        this.g = g as number;
        this.b = b as number;
        this.a = a as number;
    }

    private static _normalize(value: number): number {
        return clamp(0 | (value > 0.0 && value < 1.0 ? value * 255 : value), 0, 255);
    }

    private _to_hex(): string {
        return `#${this.r.toString(16).padStart(2, '0')}${this.g.toString(16).padStart(2, '0')}${this.b.toString(16).padStart(2, '0')}${this.a.toString(16).padStart(2, '0')}`;
    }

    private _parse_hex_color_string(hex: string): number[] {
        const result: RegExpExecArray | null = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?$/i.exec(hex);

        return result ? [
            parseInt(result[1], 16),
            parseInt(result[2], 16),
            parseInt(result[3], 16),
            result[4] ? parseInt(result[4], 16) : 255
        ] : [255, 255, 255, 255];
    }

    public static fromHsv(h: number, s: number, v: number, a: number = 255): Color {
        let r: number = 0
        let g: number = 0
        let b: number = 0;

        let i = Math.floor(h * 6);
        let f = h * 6 - i;
        let p = v * (1 - s);
        let q = v * (1 - f * s);
        let t = v * (1 - (1 - f) * s);

        switch (i % 6) {
            case 0: r = v, g = t, b = p; break;
            case 1: r = q, g = v, b = p; break;
            case 2: r = p, g = v, b = t; break;
            case 3: r = p, g = q, b = v; break;
            case 4: r = t, g = p, b = v; break;
            case 5: r = v, g = p, b = q; break;
        }

        return new Color(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255), a);
    }

    public static get BLACK(): Color { return new Color(0, 0, 0, 255); }
    public static get GRAY(): Color { return new Color(128, 128, 128, 255); }
    public static get WHITE(): Color { return new Color(255, 255, 255, 255); }
    public static get RED(): Color { return new Color(255, 0, 0, 255); }
    public static get GREEN(): Color { return new Color(0, 255, 0, 255); }
    public static get BLUE(): Color { return new Color(0, 0, 255, 255); }
    public static get YELLOW(): Color { return new Color(255, 255, 0, 255); }
    public static get ORANGE(): Color { return new Color(255, 128, 0, 255); }
    public static get PURPLE(): Color { return new Color(128, 0, 128, 255); }
    public static get CYAN(): Color { return new Color(0, 255, 255, 255); }
    public static get MAGENTA(): Color { return new Color(255, 0, 255, 255); }

    public static fromName(name: string): Color {
        const element = document.createElement('div');
        element.style.color = name;
        document.body.appendChild(element);

        const computedColor = getComputedStyle(element).color;
        document.body.removeChild(element);

        const rgba = computedColor.match(/\d+/g);

        if (rgba && rgba.length === 4) {
            const [r, g, b, a] = rgba.map(Number);
            return new Color(r, g, b, a);
        } else {
            logwrn(`Color: invalid CSS color name: ${name}. Defaulting to transparent.`);
            return Color.TRANSPARENT;
        }
    }

    public static get TRANSPARENT(): Color { return new Color(0, 0, 0, 0); }
}
