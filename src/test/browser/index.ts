// Entry for the browser tests, bundled by scripts/browser-tests.js for both the local test page
// (npm run test:browser) and headless Chromium (npm run test:browser:headless).
import { runTests, type RunOptions } from '../assert';
import { webglRendererTests } from './webgl-renderer-tests';
import { webglTests } from './webgl-tests';

declare global {
    interface Window {
        __runTests: (options?: RunOptions) => ReturnType<typeof runTests>,
        __exitCode?: number,
    }
}

window.__runTests = (options) => runTests([webglTests, webglRendererTests], options);
