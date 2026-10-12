// Runs inside headless Chromium (see scripts/test-browser.mjs).
import { CreateBuffer, CreateRenderTarget, CreateVertexArray } from '../../webgl';
import { WebGlRenderer } from '../../webgl-renderer';
import { assert, type TestSuite } from '../assert';

const pixel = (gl: WebGL2RenderingContext, x: number, y: number): number[] => {
    const out = new Uint8Array(4);
    gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
    return [...out];
};

const VS = `#version 300 es
in vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }`;

const FS = `#version 300 es
precision highp float;
uniform vec4 uColor;
out vec4 color;
void main() { color = uColor; }`;

const nextEvent = (target: EventTarget, type: string) => new Promise<void>(resolve => target.addEventListener(type, () => resolve(), { once: true }));

export const webglRendererTests: TestSuite = {
    'WebGlRenderer: sizes in CSS pixels, buffer x pixel ratio, fills its parent'() {
        const parent = document.createElement('div');
        parent.style.width = '120px';
        parent.style.height = '80px';
        document.body.appendChild(parent);

        const renderer = new WebGlRenderer({ parent, pixelRatio: 2 });

        assert.equal(renderer.canvas.parentElement, parent);
        assert.equal(renderer.width, 120);
        assert.equal(renderer.height, 80);
        assert.equal(renderer.aspectRatio, 1.5);
        assert.equal(renderer.canvas.width, 240);
        assert.equal(renderer.canvas.height, 160);
        assert.equal(renderer.canvas.style.width, '120px');
        assert.equal(renderer.canvas.getBoundingClientRect().width, 120); // shows at CSS size, not buffer size

        assert.ok(!renderer.resize()); // unchanged
        assert.ok(renderer.resize(50, 40));
        assert.equal(renderer.canvas.width, 100);

        renderer.appendTo();
        assert.equal(renderer.canvas.parentElement, null);

        renderer.dispose();
        parent.remove();
    },

    'WebGlRenderer: clear, draw, render targets'() {
        const renderer = new WebGlRenderer({ pixelRatio: 1, attributes: { antialias: false, preserveDrawingBuffer: true } });
        const gl = renderer.gl;

        renderer.resize(32, 32);
        renderer.clear([0, 0, 1, 1]);
        assert.deepEqual(pixel(gl, 16, 16), [0, 0, 255, 255]);

        const info = renderer.createProgram(VS, FS);
        const vao = CreateVertexArray(gl, info, { aPosition: { buffer: CreateBuffer(gl, [-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), size: 2 } });

        renderer.draw(info, vao, { count: 6, uniforms: { uColor: [1, 1, 0, 1] } });
        assert.deepEqual(pixel(gl, 16, 16), [255, 255, 0, 255]);

        const target = CreateRenderTarget(gl, 8, 8);

        renderer.setRenderTarget(target);
        renderer.clear([1, 0, 0, 1]);
        assert.deepEqual(pixel(gl, 4, 4), [255, 0, 0, 255]);
        assert.equal(gl.getParameter(gl.VIEWPORT)[2], 8);

        renderer.setRenderTarget(null);
        assert.deepEqual(pixel(gl, 16, 16), [255, 255, 0, 255]); // canvas untouched
        assert.equal(gl.getParameter(gl.VIEWPORT)[2], 32);

        assert.equal(gl.getError(), gl.NO_ERROR);
        renderer.dispose();
    },

    async 'WebGlRenderer: context loss and restore are reported; drawing is skipped meanwhile'() {
        const renderer = new WebGlRenderer({ pixelRatio: 1 });
        const gl = renderer.gl;
        const events: string[] = [];

        renderer.onContextLost.subscribe(() => events.push('lost'));
        renderer.onContextRestored.subscribe(() => events.push('restored'));

        const info = renderer.createProgram(VS, FS);
        const vao = CreateVertexArray(gl, info, { aPosition: { buffer: CreateBuffer(gl, [-1, -1, 1, -1, 1, 1]), size: 2 } });

        const lose = gl.getExtension('WEBGL_lose_context')!;
        assert.ok(lose, 'WEBGL_lose_context unavailable');

        const lost = nextEvent(renderer.canvas, 'webglcontextlost');
        lose.loseContext();
        await lost;

        assert.ok(renderer.isContextLost);
        renderer.draw(info, vao, { count: 3, uniforms: { uColor: [1, 0, 0, 1] } }); // no throw, nothing drawn

        // restoring is only allowed once the browser has finished dispatching the lost event
        await new Promise(resolve => setTimeout(resolve, 0));

        const restored = nextEvent(renderer.canvas, 'webglcontextrestored');
        lose.restoreContext();
        await restored;

        assert.ok(!renderer.isContextLost);
        assert.deepEqual(events, ['lost', 'restored']);
        assert.ok(gl.isEnabled(gl.DEPTH_TEST)); // default state re-applied

        renderer.dispose();
    },
};
