// Runs the browser-only tests (real WebGL2) in headless Chromium.
//
//   npm run test:browser
//
// Uses the Chromium Playwright would install, or set CHROMIUM_PATH to any Chrome / Chromium binary.

import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const executablePath = process.env.CHROMIUM_PATH
    ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

const bundle = await build({
    stdin: {
        contents: `
            import { runTests } from './src/test/assert';
            import { webglTests } from './src/test/browser/webgl-tests';
            import { webglRendererTests } from './src/test/browser/webgl-renderer-tests';
            window.__runTests = () => runTests(webglTests, webglRendererTests);
        `,
        resolveDir: process.cwd(),
        loader: 'ts',
    },
    bundle: true,
    format: 'iife',
    write: false,
    define: { 'process.exitCode': 'window.__exitCode' },
});

const browser = await chromium.launch({
    executablePath,
    // software WebGL, so this works without a GPU (CI, containers)
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

try {
    const page = await browser.newPage();

    page.on('console', message => console.log(message.text()));
    page.on('pageerror', error => { console.error(error); process.exitCode = 1; });

    await page.setContent('<!doctype html><html><body></body></html>');
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await page.evaluate(() => window.__runTests());

    if (await page.evaluate(() => window.__exitCode)) process.exitCode = 1;
} finally {
    await browser.close();
}
