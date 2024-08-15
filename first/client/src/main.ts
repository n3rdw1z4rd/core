import './css';
import './dev';
import { DEV_LOGGER } from './utils';

const log = DEV_LOGGER;

let initialSeed: number = 42;

const mulberry32 = (seed: number): Function => (): number => {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;

    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;

    return ((t ^ t >>> 14) >>> 0) / 4294967296;
};

const splitmix32 = (seed: number): Function => (): number => {
    seed |= 0;
    seed = seed + 0x9e3779b9 | 0;

    var t = seed ^ seed >>> 15;
    t = Math.imul(t, 0x85ebca6b);
    t = t ^ t >>> 13;
    t = Math.imul(t, 0xc2b2ae35);

    return ((t = t ^ t >>> 16) >>> 0) / 4294967296;
}


for (let t = 0; t < 10; t++)
    log(`${t}: splitmix32(${initialSeed}):`, splitmix32(initialSeed));

log('+new Date():', +new Date() + Math.random());
