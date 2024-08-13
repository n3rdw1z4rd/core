import { DEV } from './env';

export const DEV_LOGGER = DEV
    ? console.debug.bind(
        console,
        '%c[dev]',
        'background: cyan; color: black; padding: 2px; border-radius: 4px; font-weight: bold;',
    )
    : (..._: any[]): void => { };
