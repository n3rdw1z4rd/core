/**
 * Color as `[r, g, b]`, each 0-255.
 * @category Color
 */
export type RGB = readonly [number, number, number];
/**
 * Flat list of colors, each packed as a `0xRRGGBB` integer, as returned by {@link buildColorPalette}.
 * @category Color
 */
export type ColorPalette = readonly number[];

const DEFAULT_COLORS: readonly RGB[] = [
    [237, 28, 36],   // red
    [255, 127, 39],  // orange
    [255, 242, 0],   // yellow
    [34, 177, 76],   // green
    [0, 183, 239],   // cyan
    [63, 72, 204],   // blue
    [163, 73, 164],  // purple
    [236, 0, 140],   // magenta
    [255, 174, 201], // pink
    [139, 90, 43],   // brown
    [214, 181, 129], // tan
    [128, 128, 0],   // olive
    [0, 128, 128],   // teal
    [128, 0, 32],    // maroon
];

function packRGB(r: number, g: number, b: number): number {
    r = Math.min(255, Math.max(0, Math.round(r)));
    g = Math.min(255, Math.max(0, Math.round(g)));
    b = Math.min(255, Math.max(0, Math.round(b)));

    return (r << 16) | (g << 8) | b;
}

const DARK_FLOOR = 0.28; // darkest step keeps this fraction of the base color, so it stays identifiable instead of crushing to black

// Ramp a single color from itself (step 0) down to a dark-but-still-colored
// version (last step) - never all the way to black.
function colorRamp(rgb: RGB, steps: number): number[] {
    const [r, g, b] = rgb;
    const out: number[] = [];

    for (let i = 0; i < steps; i++) {
        const t = steps === 1 ? 0 : i / (steps - 1);
        const scale = 1 - t * (1 - DARK_FLOOR); // 1 = full color, DARK_FLOOR = darkest step

        out.push(packRGB(r * scale, g * scale, b * scale));
    }

    return out;
}

/**
 * Builds a flat color palette of packed `0xRRGGBB` integers: a grayscale ramp (black -> white)
 * followed by a light -> dark ramp for each supplied color. Length is
 * `grayscaleSteps + colors.length * colorSteps`.
 *
 * @param grayscaleSteps number of grayscale entries, black -> white (a single step is black)
 * @param colorSteps number of steps per color, from the full color down to 28% of it (never black)
 * @param colors base RGB colors to ramp; defaults to 14 common colors (red, orange, yellow,
 *               green, cyan, blue, purple, magenta, pink, brown, tan, olive, teal, maroon).
 *               White is always included via the grayscale ramp.
 * @category Color
 */
export function buildColorPalette(
    grayscaleSteps: number = 8,
    colorSteps: number = 4,
    ...colors: RGB[]
): ColorPalette {
    const palette: number[] = [];

    for (let i = 0; i < grayscaleSteps; i++) {
        const v = grayscaleSteps === 1 ? 0 : (i / (grayscaleSteps - 1)) * 255;
        palette.push(packRGB(v, v, v));
    }

    const colorList = colors.length > 0 ? colors : DEFAULT_COLORS;

    for (const rgb of colorList) {
        palette.push(...colorRamp(rgb, colorSteps));
    }

    return palette;
}
