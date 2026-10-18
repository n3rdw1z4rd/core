// Serves the browser tests (real WebGL2) as a page and opens it in your default browser.
// The tests are re-bundled from source on every page load: edit, then refresh to re-run.
//
//   npm run test:browser                  # opens http://localhost:5174
//   npm run test:browser -- --no-open     # just serve
//   PORT=8080 npm run test:browser
//
// For automated runs without a desktop browser: npm run test:browser:headless

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { bundleBrowserTests } from './browser-tests.mjs';

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>core: browser tests</title>
<style>
    :root { color-scheme: dark; }
    body { margin: 0; padding: 24px; background: #111; color: #ddd; font: 14px/1.5 ui-monospace, monospace; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    #gpu { color: #888; margin-bottom: 16px; }
    #summary { font-size: 16px; margin: 12px 0; }
    #summary.pass { color: #5c5; } #summary.fail { color: #f66; }
    ul { list-style: none; padding: 0; margin: 0; }
    li { padding: 4px 0; border-bottom: 1px solid #222; }
    .ok::before { content: '✓ '; color: #5c5; }
    .bad::before { content: '✗ '; color: #f66; }
    .ms { color: #666; float: right; }
    pre { color: #f99; background: #1a1111; padding: 8px; overflow-x: auto; white-space: pre-wrap; margin: 6px 0 2px; }
    button { font: inherit; background: #333; color: #ddd; border: 1px solid #555; padding: 4px 12px; cursor: pointer; }
</style>
</head>
<body>
<h1>core: browser tests <button onclick="location.reload()">re-run</button></h1>
<div id="gpu"></div>
<div id="summary">running…</div>
<ul id="results"></ul>
<script src="/tests.js"></script>
<script>
    const gl = document.createElement('canvas').getContext('webgl2');
    const info = gl && gl.getExtension('WEBGL_debug_renderer_info');
    document.getElementById('gpu').textContent = gl
        ? 'WebGL2: ' + (info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER))
        : 'WebGL2 is not available in this browser';

    const list = document.getElementById('results');
    const summary = document.getElementById('summary');

    const escape = (s) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

    window.__runTests({
        onResult(result) {
            const item = document.createElement('li');
            item.className = result.ok ? 'ok' : 'bad';
            item.innerHTML = escape(result.name) + '<span class="ms">' + result.ms.toFixed(0) + ' ms</span>'
                + (result.ok ? '' : '<pre>' + escape(result.error) + '</pre>');
            list.appendChild(item);
        },
    }).then((results) => {
        const failed = results.filter(r => !r.ok).length;
        summary.textContent = (results.length - failed) + ' passed, ' + failed + ' failed';
        summary.className = failed ? 'fail' : 'pass';
        document.title = (failed ? '✗ ' : '✓ ') + document.title;
    });
</script>
</body>
</html>`;

// a bundling error becomes a visible error on the page instead of a blank one
const errorScript = (error) => `
    document.getElementById('summary').textContent = 'build failed';
    document.getElementById('summary').className = 'fail';
    document.getElementById('results').innerHTML = '<pre>' + ${JSON.stringify(String(error?.message ?? error))}.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]) + '</pre>';
    window.__runTests = () => new Promise(() => {});
`;

const server = createServer(async (request, response) => {
    if (request.url === '/' || request.url === '/index.html') {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        response.end(PAGE);
    } else if (request.url === '/tests.js') {
        let script;

        try {
            script = await bundleBrowserTests();
        } catch (error) {
            console.error(error.message);
            script = errorScript(error);
        }

        response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
        response.end(script);
    } else {
        response.writeHead(404);
        response.end();
    }
});

const open = (url) => {
    const [command, ...args] = process.platform === 'darwin' ? ['open', url]
        : process.platform === 'win32' ? ['cmd', '/c', 'start', '', url]
        : ['xdg-open', url];

    spawn(command, args, { stdio: 'ignore', detached: true }).on('error', () => { }).unref();
};

const listen = (port) => server.listen(port, '127.0.0.1');

server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') listen(0); // port taken: use any free one
    else throw error;
});

server.on('listening', () => {
    const url = `http://localhost:${server.address().port}`;

    console.log(`browser tests: ${url}   (refresh to re-run; Ctrl+C to stop)`);

    if (!process.argv.includes('--no-open')) open(url);
});

listen(Number(process.env.PORT ?? 5174));
