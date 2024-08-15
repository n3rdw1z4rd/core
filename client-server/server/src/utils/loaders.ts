import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { warn } from './logger';

export function ReadJsonAsync(path: string): Promise<Object> {
    path = resolve(path);

    return readFile(path, { encoding: 'utf8' })
        .then(content => JSON.parse(content))
        .catch((reason: any) => {
            warn(`ReadJsonAsync: ERROR: failed to read "${path}"`);
            return null;
        });
}