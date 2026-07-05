import { clamp } from "./math";
import { KeyValue } from "./types";

/** Whether `target` is exactly `null` or `undefined` (not other falsy values like `0` or `''`). */
export function isNullOrUndefined(target: any): boolean {
    return (target === null || target === undefined);
}

/** Whether `target` is a non-empty string. */
export function isPositiveString(target: string): boolean {
    return (target.length > 0);
}

/** Picks a hex color from a fixed 11-step red-yellow-green ramp based on `min / max` (or just `min` against `1` if `max` is omitted) - handy for coloring a value on a "bad to good" scale. */
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

/** Parses the current page URL's query string into a plain key/value object. */
export function GetUrlParams(): KeyValue {
    const params: KeyValue = {};

    const url = new URLSearchParams(location.search);

    for (const [key, value] of url.entries()) {
        params[key] = value;
    }

    return params;
}

