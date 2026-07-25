import { imul } from "./math";

function _hash(seed: number): number {
    seed |= 0;

    seed ^= seed >>> 16;
    seed = imul(seed, 0x85ebca6b);

    seed ^= seed >>> 13;
    seed = imul(seed, 0xc2b2ae35);

    seed ^= seed >>> 16;

    return seed >>> 0;
}

export class Random {
    static hash(...values: number[]): number {
        let seed = 0;

        for (const value of values) {
            seed ^= value | 0;
            seed = _hash(seed);
        }

        return seed;
    }

    static nextf(seed: number): number {
        return _hash(seed) / 0x100000000;
    }

    static nexti(seed: number, max: number = Number.MAX_SAFE_INTEGER): number {
        return _hash(seed) % max;
    }
}
