import { clamp } from "./math";
import { KeyValue } from "./types";

/**
 * True if `target` is `null` or `undefined`.
 * @category Utilities
 */
export function isNullOrUndefined(target: any): boolean {
    return (target === null || target === undefined);
}

/**
 * True if `target` is a non-empty string.
 * @category Utilities
 */
export function isPositiveString(target: string): boolean {
    return (target.length > 0);
}

/**
 * Maps `min / max` onto an 11-step red -> yellow -> green gradient and returns its `'#rrggbb'`
 * color; ratios at or below 0 are red, ratios at or above 1 are green. Despite its name, `min` is
 * the value being rated. With a single argument the ratio is `min / 1`, and `max` below 1 is
 * raised to 1.
 * @category Utilities
 */
export const getRedYellowGreenGradientHex = (min: number, max?: number): string => {
    if (max === undefined) {
        max = min;
        min = 0;
    }

    if (max < 1) {
        max = 1;
    }

    const percent = (min / max);
    const index = clamp(Math.floor(percent * 10), 0, 10);

    return ([
        '#ff0000', '#ff3300', '#ff6600', '#ff9900', '#ffcc00',
        '#ffff00', '#ccff00', '#99ff00', '#66ff00', '#33ff00',
        '#00ff00'
    ])[index];
}

/**
 * The current page's query-string parameters as a plain object of strings (the last value wins
 * for repeated keys). Needs `location`, so browser only.
 * @category Utilities
 */
export function GetUrlParams(): KeyValue {
    const params: KeyValue = {};

    const url = new URLSearchParams(location.search);

    for (const [key, value] of url.entries()) {
        params[key] = value;
    }

    return params;
}

/**
 * Joins `x` and `y` into a string key such as `'3,4'`, e.g. for use in a `Map` or `Set`.
 * @category Utilities
 */
export const xy2k = (x: number, y: number, delimiter: string = ','): string => (`${x}${delimiter}${y}`);
/**
 * Splits a key made by {@link xy2k} back into `[x, y]` (parsed with `parseFloat`).
 * @category Utilities
 */
export const k2xy = (key: string, delimiter: string = ','): [number, number] => key.split(delimiter).map(parseFloat) as [number, number];

/**
 * Joins `x`, `y` and `z` into a string key such as `'1,2,3'`.
 * @category Utilities
 */
export const xyz2k = (x: number, y: number, z: number, delimiter: string = ','): string => (`${x}${delimiter}${y}${delimiter}${z}`);
/**
 * Splits a key made by {@link xyz2k} back into `[x, y, z]` (parsed with `parseFloat`).
 * @category Utilities
 */
export const k2xyz = (key: string, delimiter: string = ','): [number, number, number] => key.split(delimiter).map(parseFloat) as [number, number, number];
