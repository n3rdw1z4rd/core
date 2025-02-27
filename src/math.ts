import { vec3 } from 'gl-matrix';

const DEG2RAD = 0.01745329;

export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

export function deg2rad(value: number): number {
    return value * DEG2RAD;
}

export function lerp(start: number, end: number, scale: number): number {
    return start * (1 - scale) + end * scale;
}
