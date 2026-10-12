// Runs the browser tests (real WebGL2) in headless Chromium via playwright-core: for automated
// runs (CI, or checking changes without a desktop browser). For the local page: npm run test:browser
//
//   npm run test:browser:headless
//
// Browser: CHROMIUM_PATH if set, else Playwright's preinstalled Chromium if present, else the
// installed Google Chrome (no download needed).

import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import { bundleBrowserTests } from './browser-tests.mjs';

const executablePath = process.env.CHROMIUM_PATH
    ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

const bundle = await bundleBrowserTests();

const browser = await chromium.launch({
    ...(executablePath ? { executablePath } : { channel: 'chrome' }),
    // software WebGL, so this works without a GPU (CI, containers)
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

try {
    const page = await browser.newPage();

    page.on('console', message => console.log(message.text()));
    page.on('pageerror', error => { console.error(error); process.exitCode = 1; });

    await page.setContent('<!doctype html><html><body></body></html>');
    await page.addScriptTag({ content: bundle });
    await page.evaluate(() => window.__runTests());

    if (await page.evaluate(() => window.__exitCode)) process.exitCode = 1;
} finally {
    await browser.close();
}
