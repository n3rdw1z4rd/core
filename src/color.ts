import { clamp } from './math';
import { log } from './log';

/**
 * RGBA color with 8-bit channels (integers 0-255), kept in sync with an 8-digit hex string.
 * Setting a channel rounds and clamps it to 0-255.
 *
 * ```ts
 * new Color(255, 128, 0);           // opaque orange
 * new Color('#ff8000');             // same, from a hex string
 * Color.fromHsv(0.5, 1, 1).hexStr;  // '#00ffffff'
 * ```
 * @category Color
 */
export class Color {
    private _hex: string = '#ffffffff';
    private _r: number = 255;
    private _g: number = 255;
    private _b: number = 255;
    private _a: number = 255;

    /** red, 0-255 */
    public get r(): number { return this._r; }
    /** rounded and clamped to 0-255 */
    public set r(value: number) {
        this._r = Color._channel(value);
        this._hex = this._to_hex();
    }

    /** green, 0-255 */
    public get g(): number { return this._g; }
    /** rounded and clamped to 0-255 */
    public set g(value: number) {
        this._g = Color._channel(value);
        this._hex = this._to_hex();
    }

    /** blue, 0-255 */
    public get b(): number { return this._b; }
    /** rounded and clamped to 0-255 */
    public set b(value: number) {
        this._b = Color._channel(value);
        this._hex = this._to_hex();
    }

    /** alpha, 0-255 (255 = opaque) */
    public get a(): number { return this._a; }
    /** rounded and clamped to 0-255 */
    public set a(value: number) {
        this._a = Color._channel(value);
        this._hex = this._to_hex();
    }

    /**
     * lowercase `'#rrggbbaa'`. Accepts `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa` when set (alpha
     * defaults to ff); an invalid string is logged and the color is left unchanged.
     */
    public get hexStr(): string { return this._hex; }
    /** `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa`; invalid strings are logged and ignored */
    public set hexStr(value: string) {
        const rgba = Color._parse_hex_color_string(value);

        if (rgba) {
            [this._r, this._g, this._b, this._a] = rgba;
            this._hex = this._to_hex();
        } else {
            log(`Color: invalid color string: ${value}. Should be a hexadecimal color string (i.e.: '#ffffff' or '#ffffffff'). Keeping the current color.`);
        }
    }

    /** a new `[r, g, b, a]` array, each 0-255 */
    public get rgba(): number[] { return [this._r, this._g, this._b, this._a]; }

    /**
     * Creates a color from a hex string (as accepted by {@link Color.hexStr}) or from channel
     * values, each rounded and clamped to 0-255 like the channel setters. An invalid string is
     * logged and gives opaque white. Defaults to opaque white.
     */
    constructor(r: string | number = 255, g: number = 255, b: number = 255, a: number = 255) {
        if (typeof r === 'string') {
            const rgba = Color._parse_hex_color_string(r);

            if (rgba) {
                [r, g, b, a] = rgba;
            } else {
                log(`Color: invalid color string: ${r}. Should be a hexadecimal color string (i.e.: '#ffffff' or '#ffffffff'). Defaulting to opaque white.`);
                r = g = b = a = 255;
            }
        }

        this.r = r as number;
        this.g = g as number;
        this.b = b as number;
        this.a = a as number;
    }

    private static _channel(value: number): number {
        return clamp(Math.round(value), 0, 255);
    }

    private _to_hex(): string {
        return `#${this.r.toString(16).padStart(2, '0')}${this.g.toString(16).padStart(2, '0')}${this.b.toString(16).padStart(2, '0')}${this.a.toString(16).padStart(2, '0')}`;
    }

    // accepts #rgb, #rgba, #rrggbb and #rrggbbaa; returns undefined for anything else
    private static _parse_hex_color_string(hex: string): number[] | undefined {
        let digits = /^#([a-f\d]{3,4}|[a-f\d]{6}|[a-f\d]{8})$/i.exec(hex)?.[1];

        if (!digits) return undefined;

        if (digits.length <= 4) {
            digits = [...digits].map(d => d + d).join('');
        }

        return [
            parseInt(digits.slice(0, 2), 16),
            parseInt(digits.slice(2, 4), 16),
            parseInt(digits.slice(4, 6), 16),
            digits.length === 8 ? parseInt(digits.slice(6, 8), 16) : 255,
        ];
    }

    /**
     * Creates a color from hue, saturation and value, each in [0, 1]
     * (hues outside [0, 1) wrap around).
     * @param a alpha, 0-255 (default 255)
     */
    public static fromHsv(h: number, s: number, v: number, a: number = 255): Color {
        let r: number = 0
        let g: number = 0
        let b: number = 0;

        h = ((h % 1) + 1) % 1; // wrap any hue, including negative ones, into [0, 1)

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

    /** new opaque black */
    public static get BLACK(): Color { return new Color(0, 0, 0, 255); }
    /** new opaque gray (128, 128, 128) */
    public static get GRAY(): Color { return new Color(128, 128, 128, 255); }
    /** new opaque white */
    public static get WHITE(): Color { return new Color(255, 255, 255, 255); }
    /** new opaque red (255, 0, 0) */
    public static get RED(): Color { return new Color(255, 0, 0, 255); }
    /** new opaque green (0, 255, 0) */
    public static get GREEN(): Color { return new Color(0, 255, 0, 255); }
    /** new opaque blue (0, 0, 255) */
    public static get BLUE(): Color { return new Color(0, 0, 255, 255); }
    /** new opaque yellow (255, 255, 0) */
    public static get YELLOW(): Color { return new Color(255, 255, 0, 255); }
    /** new opaque orange (255, 128, 0) */
    public static get ORANGE(): Color { return new Color(255, 128, 0, 255); }
    /** new opaque purple (128, 0, 128) */
    public static get PURPLE(): Color { return new Color(128, 0, 128, 255); }
    /** new opaque cyan (0, 255, 255) */
    public static get CYAN(): Color { return new Color(0, 255, 255, 255); }
    /** new opaque magenta (255, 0, 255) */
    public static get MAGENTA(): Color { return new Color(255, 0, 255, 255); }

    /**
     * Creates a color from any CSS color string (e.g. `'rebeccapurple'`, `'rgb(0 0 0 / 50%)'`) by
     * letting the browser compute it. Needs a DOM: it briefly appends an element to
     * `document.body`. An unrecognised name is logged and gives {@link Color.TRANSPARENT}.
     */
    public static fromName(name: string): Color {
        const element = document.createElement('div');
        element.style.color = name;
        document.body.appendChild(element);

        const computedColor = getComputedStyle(element).color;
        document.body.removeChild(element);

        // computed colors look like 'rgb(255, 0, 0)' or 'rgba(255, 0, 0, 0.5)'
        const rgba = computedColor.match(/[\d.]+/g)?.map(Number);

        if (element.style.color && rgba && (rgba.length === 3 || rgba.length === 4)) {
            const [r, g, b, a = 1] = rgba;
            const color = new Color(r, g, b);
            color.a = a * 255;
            return color;
        } else {
            log(`Color: invalid CSS color name: ${name}. Defaulting to transparent.`);
            return Color.TRANSPARENT;
        }
    }

    /** new fully transparent black (0, 0, 0, 0) */
    public static get TRANSPARENT(): Color { return new Color(0, 0, 0, 0); }
}
