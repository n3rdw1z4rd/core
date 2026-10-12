// Runs inside headless Chromium (see scripts/test-browser.mjs): real WebGL2, checked by reading pixels back.
import {
    BindRenderTarget, CompileShader, CreateBuffer, CreateProgram, CreateProgramInfo, CreateRenderTarget, CreateTexture,
    CreateVertexArray, CreateWebGlContext, DeleteProgramInfo, DeleteRenderTarget, DeleteTexture, DeleteVertexArray, Draw,
    LoadWebGlTexture, ResizeRenderTarget, ResizeWebGlContext, SetUniforms, ShaderType, UpdateBuffer, UpdateTexture,
} from '../../webgl';
import { assert, type TestSuite } from '../assert';

const SIZE = 64;

const setup = () => {
    const canvas = document.createElement('canvas');
    const gl = CreateWebGlContext(canvas, { antialias: false, preserveDrawingBuffer: true });

    ResizeWebGlContext(gl, SIZE, SIZE, 1);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    return gl;
};

// RGBA at (x, y), origin bottom-left
const pixel = (gl: WebGL2RenderingContext, x: number, y: number): number[] => {
    const out = new Uint8Array(4);
    gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
    return [...out];
};

const near = (actual: number[], expected: number[], tolerance = 2) =>
    actual.length === expected.length && actual.every((v, i) => Math.abs(v - expected[i]) <= tolerance);

const assertPixel = (gl: WebGL2RenderingContext, x: number, y: number, expected: number[]) => {
    const actual = pixel(gl, x, y);
    assert.ok(near(actual, expected), `pixel (${x}, ${y}): expected ${expected}, got ${actual}`);
};

const noErrors = (gl: WebGL2RenderingContext) => assert.equal(gl.getError(), gl.NO_ERROR);

// fills clip space with a quad from 2D positions
const QUAD_VS = `#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main() {
    vUv = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const QUAD = new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]);
const QUAD_INDICES = new Uint16Array([0, 1, 2, 0, 2, 3]);

export const webglTests: TestSuite = {
    'context: resize uses CSS size x pixel ratio, reports changes'() {
        const gl = setup();

        assert.ok(ResizeWebGlContext(gl, 100, 50, 2));
        assert.equal(gl.canvas.width, 200);
        assert.equal(gl.canvas.height, 100);
        assert.equal(gl.getParameter(gl.VIEWPORT)[2], 200);
        assert.ok(!ResizeWebGlContext(gl, 100, 50, 2));
    },

    'shaders: compile errors quote the failing line; link errors throw'() {
        const gl = setup();
        const source = `#version 300 es
precision highp float;
out vec4 color;
void main() {
    color = vec4(undefinedThing, 1.0);
}`;

        let message = '';
        try { CompileShader(gl, ShaderType.FRAGMENT, source); } catch (e) { message = (e as Error).message; }

        assert.ok(message.includes('fragment shader failed to compile'), message);
        assert.ok(message.includes('>    5 |     color = vec4(undefinedThing, 1.0);'), message);

        // varying the fragment shader expects isn't written by the vertex shader: link error
        let linkError = '';
        try {
            CreateProgram(gl, QUAD_VS, `#version 300 es
precision highp float;
in vec3 vMissing;
out vec4 color;
void main() { color = vec4(vMissing, 1.0); }`);
        } catch (e) { linkError = (e as Error).message; }

        assert.ok(linkError.startsWith('CreateProgram: failed to link'), linkError);
        noErrors(gl);
    },

    'program info: attributes, uniform types, array base names, sampler units'() {
        const gl = setup();
        const info = CreateProgramInfo(gl, QUAD_VS, `#version 300 es
precision highp float;
uniform vec3 uColor;
uniform float uWeights[3];
uniform sampler2D uTextures[2];
uniform sampler2D uMask;
in vec2 vUv;
out vec4 color;
void main() {
    color = vec4(uColor * uWeights[0] * uWeights[2], 1.0) + texture(uTextures[0], vUv) + texture(uTextures[1], vUv) + texture(uMask, vUv);
}`);

        assert.ok(info.attributes.aPosition !== undefined);
        assert.equal(info.uniforms.uColor.type, gl.FLOAT_VEC3);
        assert.equal(info.uniforms.uWeights.size, 3);
        assert.equal(info.uniforms.uTextures.size, 2);

        // the array takes two consecutive units, the mask another one: no overlap (order isn't fixed)
        const array = info.uniforms.uTextures.textureUnit!;
        const units = new Set([array, array + 1, info.uniforms.uMask.textureUnit!]);
        assert.equal(units.size, 3);
        assert.ok([...units].every(u => u >= 0 && u <= 2));

        DeleteProgramInfo(gl, info);
        noErrors(gl);
    },

    'draw: indexed quad with a uniform color'() {
        const gl = setup();
        const info = CreateProgramInfo(gl, QUAD_VS, `#version 300 es
precision highp float;
uniform vec3 uColor;
out vec4 color;
void main() { color = vec4(uColor, 1.0); }`);

        const vao = CreateVertexArray(gl, info, { aPosition: { buffer: CreateBuffer(gl, QUAD), size: 2 } }, QUAD_INDICES);

        Draw(gl, info, vao, { uniforms: { uColor: [1, 0.5, 0] } });

        assertPixel(gl, 1, 1, [255, 128, 0, 255]);
        assertPixel(gl, SIZE - 2, SIZE - 2, [255, 128, 0, 255]);

        DeleteVertexArray(gl, vao, { buffers: true });
        noErrors(gl);
    },

    'draw: non-indexed triangle; plain number arrays; UpdateBuffer'() {
        const gl = setup();
        const info = CreateProgramInfo(gl, QUAD_VS, `#version 300 es
precision highp float;
out vec4 color;
void main() { color = vec4(0.0, 1.0, 0.0, 1.0); }`);

        // left half triangle only
        const buffer = CreateBuffer(gl, [-1, -1, 0, -1, -1, 1], { usage: gl.DYNAMIC_DRAW });
        const vao = CreateVertexArray(gl, info, { aPosition: { buffer, size: 2 } });

        Draw(gl, info, vao, { count: 3 });
        assertPixel(gl, 2, 2, [0, 255, 0, 255]);
        assertPixel(gl, SIZE - 2, SIZE - 2, [0, 0, 0, 255]);

        // move it to the right half
        gl.clear(gl.COLOR_BUFFER_BIT);
        UpdateBuffer(gl, buffer, [1, 1, 0, 1, 1, -1]);
        Draw(gl, info, vao, { count: 3 });
        assertPixel(gl, 2, 2, [0, 0, 0, 255]);
        assertPixel(gl, SIZE - 2, SIZE - 2, [0, 255, 0, 255]);

        noErrors(gl);
    },

    'draw: instancing with a per-instance offset and an integer attribute'() {
        const gl = setup();
        const info = CreateProgramInfo(gl, `#version 300 es
in vec2 aPosition;
in vec2 aOffset;
in uint aColorIndex;
flat out uint vColorIndex;
void main() {
    vColorIndex = aColorIndex;
    gl_Position = vec4(aPosition * 0.25 + aOffset, 0.0, 1.0);
}`, `#version 300 es
precision highp float;
flat in uint vColorIndex;
out vec4 color;
void main() {
    color = vColorIndex == 0u ? vec4(1, 0, 0, 1) : vColorIndex == 1u ? vec4(0, 1, 0, 1) : vColorIndex == 2u ? vec4(0, 0, 1, 1) : vec4(1, 1, 1, 1);
}`);

        const offsets = CreateBuffer(gl, [-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]);
        const colors = CreateBuffer(gl, new Uint8Array([0, 1, 2, 3]));

        const vao = CreateVertexArray(gl, info, {
            aPosition: { buffer: CreateBuffer(gl, QUAD), size: 2 },
            aOffset: { buffer: offsets, size: 2, divisor: 1 },
            aColorIndex: { buffer: colors, size: 1, type: gl.UNSIGNED_BYTE, divisor: 1 },
        }, QUAD_INDICES);

        Draw(gl, info, vao, { instances: 4 });

        // quarter-sized quads centered in each quadrant; the middle stays clear
        assertPixel(gl, 16, 16, [255, 0, 0, 255]);
        assertPixel(gl, 48, 16, [0, 255, 0, 255]);
        assertPixel(gl, 16, 48, [0, 0, 255, 255]);
        assertPixel(gl, 48, 48, [255, 255, 255, 255]);
        assertPixel(gl, 32, 32, [0, 0, 0, 255]);

        noErrors(gl);
    },

    'draw: per-instance mat4 attribute spread over four columns'() {
        const gl = setup();
        const info = CreateProgramInfo(gl, `#version 300 es
in vec2 aPosition;
in mat4 aTransform;
void main() { gl_Position = aTransform * vec4(aPosition * 0.25, 0.0, 1.0); }`, `#version 300 es
precision highp float;
out vec4 color;
void main() { color = vec4(1.0); }`);

        // column-major translations to (-0.5, -0.5) and (0.5, 0.5)
        const translate = (x: number, y: number) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, 0, 1];
        const transforms = CreateBuffer(gl, [...translate(-0.5, -0.5), ...translate(0.5, 0.5)]);

        const vao = CreateVertexArray(gl, info, {
            aPosition: { buffer: CreateBuffer(gl, QUAD), size: 2 },
            aTransform: { buffer: transforms, size: 4, divisor: 1 },
        }, QUAD_INDICES);

        Draw(gl, info, vao, { instances: 2 });

        assertPixel(gl, 16, 16, [255, 255, 255, 255]);
        assertPixel(gl, 48, 48, [255, 255, 255, 255]);
        assertPixel(gl, 48, 16, [0, 0, 0, 255]);

        noErrors(gl);
    },

    'uniforms: int, uint, bool, mat3, float arrays'() {
        const gl = setup();
        const info = CreateProgramInfo(gl, QUAD_VS, `#version 300 es
precision highp float;
uniform int uI;
uniform uint uU;
uniform bool uB;
uniform mat3 uM;
uniform float uF[2];
out vec4 color;
void main() {
    color = vec4(float(uI) / 255.0, float(uU) / 255.0, uB ? uM[1][0] : 0.0, uF[1]);
}`);

        const vao = CreateVertexArray(gl, info, { aPosition: { buffer: CreateBuffer(gl, QUAD), size: 2 } }, QUAD_INDICES);

        SetUniforms(gl, info, { uI: 51, uU: 102, uB: true, uM: [0, 0, 0, 0.6, 0, 0, 0, 0, 0], uF: [0, 0.8], uNotInShader: 1 });
        Draw(gl, info, vao);

        assertPixel(gl, 32, 32, [51, 102, 153, 204]);
        noErrors(gl);
    },

    'textures: data texture with nearest filtering, sampler arrays, UpdateTexture'() {
        const gl = setup();
        const info = CreateProgramInfo(gl, QUAD_VS, `#version 300 es
precision highp float;
uniform sampler2D uTextures[2];
in vec2 vUv;
out vec4 color;
void main() { color = texture(uTextures[0], vUv) + texture(uTextures[1], vUv); }`);

        // 2x2 checker: red, green / blue, white (rows bottom to top)
        const checker = CreateTexture(gl, {
            width: 2, height: 2,
            data: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]),
        }, { filter: 'nearest' });

        const black = CreateTexture(gl, { width: 1, height: 1, data: new Uint8Array([0, 0, 0, 255]) });

        const vao = CreateVertexArray(gl, info, { aPosition: { buffer: CreateBuffer(gl, QUAD), size: 2 } }, QUAD_INDICES);

        Draw(gl, info, vao, { uniforms: { uTextures: [checker, black] } });

        assertPixel(gl, 16, 16, [255, 0, 0, 255]);
        assertPixel(gl, 48, 16, [0, 255, 0, 255]);
        assertPixel(gl, 16, 48, [0, 0, 255, 255]);
        assertPixel(gl, 48, 48, [255, 255, 255, 255]);

        // replace the second texture: everything gets a bit of red added
        UpdateTexture(gl, black, { width: 1, height: 1, data: new Uint8Array([0, 0, 102, 255]) });
        Draw(gl, info, vao, { uniforms: { uTextures: [checker, black] } });
        assertPixel(gl, 48, 16, [0, 255, 102, 255]);

        DeleteTexture(gl, checker);
        DeleteTexture(gl, black);
        noErrors(gl);
    },

    async 'textures: from a canvas, and from a URL'() {
        const gl = setup();

        const image = document.createElement('canvas');
        image.width = 4;
        image.height = 4;

        const ctx = image.getContext('2d')!;
        ctx.fillStyle = '#ff00ff';
        ctx.fillRect(0, 0, 4, 4);

        const texture = CreateTexture(gl, image, { mipmaps: true });
        assert.equal(texture.width, 4);

        const info = CreateProgramInfo(gl, QUAD_VS, `#version 300 es
precision highp float;
uniform sampler2D uImage;
in vec2 vUv;
out vec4 color;
void main() { color = texture(uImage, vUv); }`);

        const vao = CreateVertexArray(gl, info, { aPosition: { buffer: CreateBuffer(gl, QUAD), size: 2 } }, QUAD_INDICES);

        Draw(gl, info, vao, { uniforms: { uImage: texture } });
        assertPixel(gl, 32, 32, [255, 0, 255, 255]);

        // same image through a URL
        ctx.fillStyle = '#00ffff';
        ctx.fillRect(0, 0, 4, 4);

        const loaded = await LoadWebGlTexture(gl, image.toDataURL());
        assert.equal(loaded.width, 4);

        Draw(gl, info, vao, { uniforms: { uImage: loaded } });
        assertPixel(gl, 32, 32, [0, 255, 255, 255]);
        noErrors(gl);
    },

    'render targets: render to texture, then sample it; resize'() {
        const gl = setup();

        const solid = CreateProgramInfo(gl, QUAD_VS, `#version 300 es
precision highp float;
uniform vec4 uColor;
out vec4 color;
void main() { color = uColor; }`);

        const sample = CreateProgramInfo(gl, QUAD_VS, `#version 300 es
precision highp float;
uniform sampler2D uScene;
in vec2 vUv;
out vec4 color;
void main() { color = texture(uScene, vUv).bgra; }`); // swizzle so the result differs from the input

        const quad = CreateBuffer(gl, QUAD);
        const solidVao = CreateVertexArray(gl, solid, { aPosition: { buffer: quad, size: 2 } }, QUAD_INDICES);
        const sampleVao = CreateVertexArray(gl, sample, { aPosition: { buffer: quad, size: 2 } }, QUAD_INDICES);

        const target = CreateRenderTarget(gl, 16, 16);

        BindRenderTarget(gl, target);
        assert.equal(gl.getParameter(gl.VIEWPORT)[2], 16);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        Draw(gl, solid, solidVao, { uniforms: { uColor: [1, 0, 0, 1] } });

        BindRenderTarget(gl, null);
        assert.equal(gl.getParameter(gl.VIEWPORT)[2], SIZE);
        Draw(gl, sample, sampleVao, { uniforms: { uScene: target.texture } });
        assertPixel(gl, 32, 32, [0, 0, 255, 255]);

        ResizeRenderTarget(gl, target, 32, 8);
        assert.equal(target.texture.width, 32);
        BindRenderTarget(gl, target);
        assert.equal(gl.checkFramebufferStatus(gl.FRAMEBUFFER), gl.FRAMEBUFFER_COMPLETE);
        BindRenderTarget(gl, null);

        DeleteRenderTarget(gl, target);
        noErrors(gl);
    },
};
