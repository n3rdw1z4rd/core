// Bundles the browser tests (src/test/browser/index.ts) into one script for a page to load.
// Shared by the local test page and the headless runner, so both run exactly the same tests.

import { build } from 'esbuild';

export async function bundleBrowserTests() {
    const result = await build({
        entryPoints: ['src/test/browser/index.ts'],
        bundle: true,
        format: 'iife',
        write: false,
        sourcemap: 'inline', // readable stack traces in the browser
        define: { 'process.exitCode': 'window.__exitCode' },
        logLevel: 'silent',
    });

    return result.outputFiles[0].text;
}
