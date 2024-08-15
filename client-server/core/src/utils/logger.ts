import { inspect } from 'node:util';
import { DEV } from '../constants';

const COLOR_RESET = '\x1b[0m';
const COLOR_DIM = '\x1b[2m';
const COLOR_RED = '\x1b[31m';
// const COLOR_GREEN = '\x1b[32m';
const COLOR_YELLOW = '\x1b[33m';
const COLOR_WHITE = '\x1b[37m';

function _log(color: string, scope: string, args: any[]) {
    args = args.map((arg: any) => (typeof arg === 'string') ? arg : inspect(arg));

    scope = `[${scope}]`;

    console.log(`${color}${(new Date()).toISOString().replace(/[TZ]/g, ' ')}${scope} ${args.join(' ')} ${COLOR_RESET}`);
};

export const log = (...args: any) => (DEV && _log(COLOR_DIM + COLOR_WHITE, 'DBG', args));
export const info = (...args: any) => _log(COLOR_WHITE, 'INF', args);
export const warn = (...args: any) => _log(COLOR_YELLOW, 'WRN', args);
export const error = (...args: any) => _log(COLOR_RED, 'ERR', args);