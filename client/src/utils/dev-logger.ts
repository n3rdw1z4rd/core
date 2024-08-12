import { DEV } from './env';

export const DEV_LOGGER = DEV
    ? console.debug.bind(console, '[dev]')
    : (..._: any[]): void => { };