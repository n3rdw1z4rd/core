import { clamp } from './math';

export function isNullOrUndefined(target: any) {
    return (target === null || target === undefined);
}

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
