// WebGL2 wrappers: thin, functional helpers over the raw API. They can be used on their own, and
// WebGlRenderer builds on them. Nothing here touches WebGL at import time, so importing is safe anywhere.

/**
 * Literal GLenum values, so importing this module doesn't require `WebGL2RenderingContext` to exist.
 *
 * @category WebGL
 */
export enum ShaderType {
    /** gl.VERTEX_SHADER */
    VERTEX = 0x8B31,
    /** gl.FRAGMENT_SHADER */
    FRAGMENT = 0x8B30,
}

// ---- context ----

/**
 * Creates a WebGL2 context. Throws (instead of returning null) when WebGL2 isn't available.
 *
 * @param canvas defaults to a new canvas element
 *
 * @category WebGL
 */
export function CreateWebGlContext(
    canvas?: HTMLCanvasElement | OffscreenCanvas,
    attributes?: WebGLContextAttributes,
): WebGL2RenderingContext {
    const target = canvas ?? document.createElement('canvas');
    const gl = target.getContext('webgl2', attributes) as WebGL2RenderingContext | null;

    if (!gl) {
        throw new Error('WebGL2 is not available (unsupported browser or GPU, or the context was lost)');
    }

    return gl;
}

/**
 * Sizes the drawing buffer to `width` x `height` CSS pixels times the pixel ratio (sharp on
 * high-DPI screens) and sets the viewport. Without a size, uses the canvas's parent (or its own)
 * size on the page. Returns whether the size changed.
 *
 * @category WebGL
 */
export function ResizeWebGlContext(
    gl: WebGL2RenderingContext,
    width?: number,
    height?: number,
    pixelRatio: number = globalThis.devicePixelRatio ?? 1,
): boolean {
    const canvas = gl.canvas;

    if (width === undefined || height === undefined) {
        const element = canvas as HTMLCanvasElement;
        const rect = element.parentElement?.getBoundingClientRect?.() ?? element.getBoundingClientRect?.();

        width ??= rect?.width ?? canvas.width;
        height ??= rect?.height ?? canvas.height;
    }

    const bufferWidth = Math.max(1, Math.round(width * pixelRatio));
    const bufferHeight = Math.max(1, Math.round(height * pixelRatio));

    if (canvas.width === bufferWidth && canvas.height === bufferHeight) return false;

    canvas.width = bufferWidth;
    canvas.height = bufferHeight;
    gl.viewport(0, 0, bufferWidth, bufferHeight);

    return true;
}

// ---- shaders and programs ----

// shows the lines a compile error points at, e.g. "ERROR: 0:12: 'foo' : undeclared identifier"
function describeShaderError(log: string, source: string): string {
    const lines = source.split('\n');
    const errorLines = new Set([...log.matchAll(/ERROR:\s*\d+:(\d+):/g)].map(m => Number(m[1])));
    const excerpt: string[] = [];

    for (const line of [...errorLines].sort((a, b) => a - b)) {
        for (let n = Math.max(1, line - 2); n <= Math.min(lines.length, line + 2); n++) {
            excerpt.push(`${n === line ? '>' : ' '} ${String(n).padStart(4)} | ${lines[n - 1]}`);
        }

        excerpt.push('');
    }

    return [log.trim(), '', ...excerpt].join('\n').trimEnd();
}

/**
 * Compiles a shader; throws an Error quoting the failing source lines.
 *
 * @category WebGL
 */
export function CompileShader(gl: WebGL2RenderingContext, type: ShaderType, source: string): WebGLShader {
    const shader = gl.createShader(type);

    if (!shader) throw new Error('CompileShader: could not create a shader (context lost?)');

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader) ?? '';
        const kind = type === ShaderType.VERTEX ? 'vertex' : 'fragment';

        gl.deleteShader(shader);

        throw new Error(`CompileShader: ${kind} shader failed to compile:\n${describeShaderError(log, source)}`);
    }

    return shader;
}

/**
 * Links a program from shader sources (or compiled shaders). Shaders compiled here are deleted
 * after linking; ones passed in are left to the caller.
 *
 * @category WebGL
 */
export function CreateProgram(
    gl: WebGL2RenderingContext,
    vertexShader: WebGLShader | string,
    fragmentShader: WebGLShader | string,
): WebGLProgram {
    const vs = typeof vertexShader === 'string' ? CompileShader(gl, ShaderType.VERTEX, vertexShader) : vertexShader;

    let fs: WebGLShader;

    try {
        fs = typeof fragmentShader === 'string' ? CompileShader(gl, ShaderType.FRAGMENT, fragmentShader) : fragmentShader;
    } catch (error) {
        if (typeof vertexShader === 'string') gl.deleteShader(vs);
        throw error;
    }

    const program = gl.createProgram();

    if (!program) throw new Error('CreateProgram: could not create a program (context lost?)');

    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    const linked = gl.getProgramParameter(program, gl.LINK_STATUS);
    const log = linked ? '' : gl.getProgramInfoLog(program) ?? '';

    for (const [shader, owned] of [[vs, typeof vertexShader === 'string'], [fs, typeof fragmentShader === 'string']] as const) {
        gl.detachShader(program, shader);
        if (owned) gl.deleteShader(shader);
    }

    if (!linked) {
        gl.deleteProgram(program);
        throw new Error(`CreateProgram: failed to link:\n${log.trim()}`);
    }

    return program;
}

/**
 * An active vertex attribute of a linked program, from {@link GetProgramLocations}.
 *
 * @category WebGL
 */
export interface AttributeInfo {
    /** attribute location (the first one, for matrices) */
    location: number,
    /** GL type of the attribute (gl.FLOAT_VEC3, gl.FLOAT_MAT4, ...) */
    type: number,
    /** array length (1 for non-arrays) */
    size: number,
}

/**
 * An active uniform of a linked program, from {@link GetProgramLocations}.
 *
 * @category WebGL
 */
export interface UniformInfo {
    /** location to pass to `gl.uniform*` */
    location: WebGLUniformLocation,
    /** GL type (gl.FLOAT_VEC3, gl.SAMPLER_2D, ...) */
    type: number,
    /** array length (1 for non-arrays) */
    size: number,
    /** samplers: first texture unit assigned to this uniform */
    textureUnit?: number,
}

/**
 * A program's active attributes and uniforms, by name.
 *
 * @category WebGL
 */
export type ProgramLocations = {
    /** by attribute name; built-ins (`gl_*`) are left out */
    attributes: Record<string, AttributeInfo>,
    /** by uniform name (arrays by their base name); uniform block members are left out */
    uniforms: Record<string, UniformInfo>,
};

/**
 * A linked program (`program`) with its attribute and uniform info, from {@link CreateProgramInfo}.
 *
 * @category WebGL
 */
export type ProgramInfo = ProgramLocations & { program: WebGLProgram };

function isSamplerType(gl: WebGL2RenderingContext, type: number): boolean {
    return samplerTarget(gl, type) !== undefined;
}

/** The texture target a sampler type binds to (TEXTURE_2D, TEXTURE_3D, ...), or undefined if it isn't a sampler. */
function samplerTarget(gl: WebGL2RenderingContext, type: number): number | undefined {
    switch (type) {
        case gl.SAMPLER_2D: case gl.SAMPLER_2D_SHADOW: case gl.INT_SAMPLER_2D: case gl.UNSIGNED_INT_SAMPLER_2D:
            return gl.TEXTURE_2D;
        case gl.SAMPLER_3D: case gl.INT_SAMPLER_3D: case gl.UNSIGNED_INT_SAMPLER_3D:
            return gl.TEXTURE_3D;
        case gl.SAMPLER_CUBE: case gl.SAMPLER_CUBE_SHADOW: case gl.INT_SAMPLER_CUBE: case gl.UNSIGNED_INT_SAMPLER_CUBE:
            return gl.TEXTURE_CUBE_MAP;
        case gl.SAMPLER_2D_ARRAY: case gl.SAMPLER_2D_ARRAY_SHADOW: case gl.INT_SAMPLER_2D_ARRAY: case gl.UNSIGNED_INT_SAMPLER_2D_ARRAY:
            return gl.TEXTURE_2D_ARRAY;
    }

    return undefined;
}

/**
 * Active attributes and uniforms of a linked program. Array uniforms are listed by their base
 * name (`uLights[0]` -> `uLights`); samplers are given consecutive texture units.
 *
 * @category WebGL
 */
export function GetProgramLocations(gl: WebGL2RenderingContext, program: WebGLProgram): ProgramLocations {
    const attributes: Record<string, AttributeInfo> = {};
    const uniforms: Record<string, UniformInfo> = {};

    const attributeCount = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES) as number;

    for (let i = 0; i < attributeCount; i++) {
        const info = gl.getActiveAttrib(program, i)!;

        if (info.name.startsWith('gl_')) continue; // built-ins like gl_VertexID

        attributes[info.name] = { location: gl.getAttribLocation(program, info.name), type: info.type, size: info.size };
    }

    const uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
    let textureUnit = 0;

    for (let i = 0; i < uniformCount; i++) {
        const info = gl.getActiveUniform(program, i)!;
        const location = gl.getUniformLocation(program, info.name);

        if (!location) continue; // uniform block members are set through buffers, not locations

        const name = info.name.endsWith('[0]') ? info.name.slice(0, -3) : info.name;
        const uniform: UniformInfo = { location, type: info.type, size: info.size };

        if (isSamplerType(gl, info.type)) {
            uniform.textureUnit = textureUnit;
            textureUnit += info.size;
        }

        uniforms[name] = uniform;
    }

    return { attributes, uniforms };
}

/**
 * Links a program and collects its attribute and uniform info.
 *
 * @category WebGL
 */
export function CreateProgramInfo(gl: WebGL2RenderingContext, vertexShaderSource: string, fragmentShaderSource: string): ProgramInfo {
    const program = CreateProgram(gl, vertexShaderSource, fragmentShaderSource);

    return { program, ...GetProgramLocations(gl, program) };
}

/**
 * Deletes the program.
 *
 * @category WebGL
 */
export function DeleteProgramInfo(gl: WebGL2RenderingContext, info: ProgramInfo): void {
    gl.deleteProgram(info.program);
}

// ---- uniforms ----

/**
 * A value for {@link SetUniforms}: a number or boolean for scalars, a numeric array for vectors,
 * matrices (column-major) and arrays of them, or a texture (or array of textures) for samplers.
 *
 * @category WebGL
 */
export type UniformValue =
    | number
    | boolean
    | ArrayLike<number>               // vectors, matrices (column-major), arrays of them
    | WebGLTexture | TextureInfo       // samplers
    | (WebGLTexture | TextureInfo)[]; // sampler arrays

const textureOf = (value: unknown): WebGLTexture | undefined => {
    if (value && typeof value === 'object' && 'texture' in value) return (value as TextureInfo).texture;
    if (typeof WebGLTexture !== 'undefined' && value instanceof WebGLTexture) return value;

    return undefined;
};

/**
 * Sets uniforms by name; the right `gl.uniform*` call comes from each uniform's declared type.
 * Textures are bound to the sampler's texture unit. Names the program doesn't use (e.g. optimized
 * away by the compiler) are ignored. Makes the program current.
 *
 * @category WebGL
 */
export function SetUniforms(gl: WebGL2RenderingContext, info: ProgramInfo, values: Record<string, UniformValue>): void {
    gl.useProgram(info.program);

    for (const name in values) {
        const uniform = info.uniforms[name];

        if (uniform) SetUniform(gl, uniform, values[name]);
    }
}

function SetUniform(gl: WebGL2RenderingContext, uniform: UniformInfo, value: UniformValue): void {
    const { location, type } = uniform;
    const target = samplerTarget(gl, type);

    if (target !== undefined) {
        const textures = Array.isArray(value) && value.length > 0 && typeof value[0] !== 'number' ? value : [value];
        const units: number[] = [];

        textures.forEach((texture, i) => {
            const unit = (uniform.textureUnit ?? 0) + i;

            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(target, textureOf(texture) ?? null);
            units.push(unit);
        });

        gl.uniform1iv(location, units);

        return;
    }

    const data: ArrayLike<number> = typeof value === 'number' ? [value]
        : typeof value === 'boolean' ? [value ? 1 : 0]
        : value as ArrayLike<number>;

    const f = data instanceof Float32Array ? data : new Float32Array(data);

    switch (type) {
        case gl.FLOAT: gl.uniform1fv(location, f); break;
        case gl.FLOAT_VEC2: gl.uniform2fv(location, f); break;
        case gl.FLOAT_VEC3: gl.uniform3fv(location, f); break;
        case gl.FLOAT_VEC4: gl.uniform4fv(location, f); break;

        case gl.INT: case gl.BOOL: gl.uniform1iv(location, Int32Array.from(data)); break;
        case gl.INT_VEC2: case gl.BOOL_VEC2: gl.uniform2iv(location, Int32Array.from(data)); break;
        case gl.INT_VEC3: case gl.BOOL_VEC3: gl.uniform3iv(location, Int32Array.from(data)); break;
        case gl.INT_VEC4: case gl.BOOL_VEC4: gl.uniform4iv(location, Int32Array.from(data)); break;

        case gl.UNSIGNED_INT: gl.uniform1uiv(location, Uint32Array.from(data)); break;
        case gl.UNSIGNED_INT_VEC2: gl.uniform2uiv(location, Uint32Array.from(data)); break;
        case gl.UNSIGNED_INT_VEC3: gl.uniform3uiv(location, Uint32Array.from(data)); break;
        case gl.UNSIGNED_INT_VEC4: gl.uniform4uiv(location, Uint32Array.from(data)); break;

        case gl.FLOAT_MAT2: gl.uniformMatrix2fv(location, false, f); break;
        case gl.FLOAT_MAT3: gl.uniformMatrix3fv(location, false, f); break;
        case gl.FLOAT_MAT4: gl.uniformMatrix4fv(location, false, f); break;
        case gl.FLOAT_MAT2x3: gl.uniformMatrix2x3fv(location, false, f); break;
        case gl.FLOAT_MAT2x4: gl.uniformMatrix2x4fv(location, false, f); break;
        case gl.FLOAT_MAT3x2: gl.uniformMatrix3x2fv(location, false, f); break;
        case gl.FLOAT_MAT3x4: gl.uniformMatrix3x4fv(location, false, f); break;
        case gl.FLOAT_MAT4x2: gl.uniformMatrix4x2fv(location, false, f); break;
        case gl.FLOAT_MAT4x3: gl.uniformMatrix4x3fv(location, false, f); break;

        default: throw new Error(`SetUniforms: unsupported uniform type 0x${type.toString(16)}`);
    }
}

// ---- buffers ----

/**
 * Options for {@link CreateBuffer}.
 *
 * @category WebGL
 */
export interface BufferOptions {
    /** default gl.ARRAY_BUFFER (gl.ELEMENT_ARRAY_BUFFER for indices) */
    target?: number,
    /** default gl.STATIC_DRAW (gl.DYNAMIC_DRAW for data updated every frame) */
    usage?: number,
}

/**
 * Creates a buffer from data (a plain number array becomes a Float32Array) or with a byte size
 * to fill later with UpdateBuffer.
 *
 * @category WebGL
 */
export function CreateBuffer(gl: WebGL2RenderingContext, data: AllowSharedBufferSource | number[] | number, options: BufferOptions = {}): WebGLBuffer {
    const target = options.target ?? gl.ARRAY_BUFFER;
    const usage = options.usage ?? gl.STATIC_DRAW;
    const buffer = gl.createBuffer();

    if (!buffer) throw new Error('CreateBuffer: could not create a buffer (context lost?)');

    gl.bindBuffer(target, buffer);

    if (typeof data === 'number') gl.bufferData(target, data, usage);
    else gl.bufferData(target, Array.isArray(data) ? new Float32Array(data) : data, usage);

    gl.bindBuffer(target, null);

    return buffer;
}

/**
 * Writes data into an existing buffer, starting at `byteOffset`.
 *
 * @category WebGL
 */
export function UpdateBuffer(gl: WebGL2RenderingContext, buffer: WebGLBuffer, data: AllowSharedBufferSource | number[], byteOffset = 0, target?: number): void {
    const t = target ?? gl.ARRAY_BUFFER;

    gl.bindBuffer(t, buffer);
    gl.bufferSubData(t, byteOffset, Array.isArray(data) ? new Float32Array(data) : data);
    gl.bindBuffer(t, null);
}

// ---- vertex arrays ----

/**
 * Where and how a vertex attribute reads its data, for {@link CreateVertexArray}.
 *
 * @category WebGL
 */
export interface AttributeSource {
    /** the buffer holding the data */
    buffer: WebGLBuffer,
    /** components per vertex (per column for matrices) */
    size: number,
    /** default gl.FLOAT */
    type?: number,
    /** integer data read as 0..1 / -1..1 floats */
    normalized?: boolean,
    /** bytes; 0 = tightly packed */
    stride?: number,
    /** bytes */
    offset?: number,
    /** 1 = advance per instance (instancing); 0 = per vertex */
    divisor?: number,
}

/**
 * A vertex array object and the buffers it reads from, from {@link CreateVertexArray}.
 *
 * @category WebGL
 */
export interface VertexArrayInfo {
    /** the vertex array object */
    vao: WebGLVertexArrayObject,
    /** buffers used, for DeleteVertexArray (an index buffer passed in as a buffer is not included) */
    buffers: WebGLBuffer[],
    /** the element buffer, when indexed */
    indexBuffer?: WebGLBuffer,
    /** gl.UNSIGNED_SHORT etc. when indexed */
    indexType?: number,
    /** default draw count: the number of indices (or the given `count`), else the vertices in the shortest per-vertex buffer */
    count?: number,
}

const BYTES: Record<number, number> = { 0x1400: 1, 0x1401: 1, 0x1402: 2, 0x1403: 2, 0x1404: 4, 0x1405: 4, 0x1406: 4, 0x140B: 2 };

function matrixColumns(gl: WebGL2RenderingContext, type: number): number {
    switch (type) {
        case gl.FLOAT_MAT2: case gl.FLOAT_MAT2x3: case gl.FLOAT_MAT2x4: return 2;
        case gl.FLOAT_MAT3: case gl.FLOAT_MAT3x2: case gl.FLOAT_MAT3x4: return 3;
        case gl.FLOAT_MAT4: case gl.FLOAT_MAT4x2: case gl.FLOAT_MAT4x3: return 4;
    }

    return 1;
}

function isIntegerAttribute(gl: WebGL2RenderingContext, type: number): boolean {
    switch (type) {
        case gl.INT: case gl.INT_VEC2: case gl.INT_VEC3: case gl.INT_VEC4:
        case gl.UNSIGNED_INT: case gl.UNSIGNED_INT_VEC2: case gl.UNSIGNED_INT_VEC3: case gl.UNSIGNED_INT_VEC4:
            return true;
    }

    return false;
}

/**
 * Records how the program's attributes read from buffers (and the index buffer) into a vertex
 * array object. Integer attributes (int / uint / ivec / uvec) use vertexAttribIPointer
 * automatically; matrix attributes (e.g. per-instance mat4) are spread over their columns.
 * Attributes the program doesn't use are skipped.
 *
 * @param indices an index array (Uint16Array / Uint32Array / Uint8Array), or an existing buffer and its type
 *
 * @category WebGL
 */
export function CreateVertexArray(
    gl: WebGL2RenderingContext,
    info: ProgramInfo,
    attributes: Record<string, AttributeSource>,
    indices?: Uint8Array | Uint16Array | Uint32Array | { buffer: WebGLBuffer, type: number, count?: number },
): VertexArrayInfo {
    const vao = gl.createVertexArray();

    if (!vao) throw new Error('CreateVertexArray: could not create a vertex array (context lost?)');

    const result: VertexArrayInfo = { vao, buffers: [] };
    let vertexCount = Infinity;

    gl.bindVertexArray(vao);

    for (const name in attributes) {
        const attribute = info.attributes[name];

        if (!attribute) continue;

        const source = attributes[name];
        const type = source.type ?? gl.FLOAT;
        const columns = matrixColumns(gl, attribute.type);
        const columnBytes = source.size * (BYTES[type] ?? 4);
        const stride = source.stride ?? (columns > 1 ? columnBytes * columns : 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, source.buffer);
        if (!result.buffers.includes(source.buffer)) result.buffers.push(source.buffer);

        // vertices this buffer holds: the last one only needs its own bytes, not a whole stride
        if (!source.divisor) {
            const bytes = gl.getBufferParameter(gl.ARRAY_BUFFER, gl.BUFFER_SIZE) as number;
            const vertexBytes = columnBytes * columns;
            const available = bytes - (source.offset ?? 0) - vertexBytes;

            vertexCount = Math.min(vertexCount, available < 0 ? 0 : Math.floor(available / (stride || vertexBytes)) + 1);
        }

        for (let column = 0; column < columns; column++) {
            const location = attribute.location + column;
            const offset = (source.offset ?? 0) + column * columnBytes;

            gl.enableVertexAttribArray(location);

            if (isIntegerAttribute(gl, attribute.type)) {
                gl.vertexAttribIPointer(location, source.size, type, stride, offset);
            } else {
                gl.vertexAttribPointer(location, source.size, type, source.normalized ?? false, stride, offset);
            }

            if (source.divisor) gl.vertexAttribDivisor(location, source.divisor);
        }
    }

    if (indices) {
        if (ArrayBuffer.isView(indices)) {
            result.indexBuffer = CreateBuffer(gl, indices, { target: gl.ELEMENT_ARRAY_BUFFER });
            result.indexType = indices instanceof Uint32Array ? gl.UNSIGNED_INT : indices instanceof Uint8Array ? gl.UNSIGNED_BYTE : gl.UNSIGNED_SHORT;
            result.count = indices.length;
            result.buffers.push(result.indexBuffer);
        } else {
            result.indexBuffer = indices.buffer;
            result.indexType = indices.type;
            result.count = indices.count;
            if (!result.buffers.includes(indices.buffer)) result.buffers.push(indices.buffer);
        }

        // the element buffer binding is part of the vertex array's state
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, result.indexBuffer);
    } else if (vertexCount < Infinity) {
        result.count = vertexCount;
    }

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    return result;
}

/**
 * Deletes the vertex array; with `buffers`, also the buffers it reads from.
 *
 * @category WebGL
 */
export function DeleteVertexArray(gl: WebGL2RenderingContext, info: VertexArrayInfo, options: { buffers?: boolean } = {}): void {
    gl.deleteVertexArray(info.vao);

    if (options.buffers) {
        for (const buffer of info.buffers) gl.deleteBuffer(buffer);
    }
}

// ---- textures ----

/**
 * Options for {@link CreateTexture} and {@link LoadWebGlTexture}.
 *
 * @category WebGL
 */
export interface TextureOptions {
    /** default 'linear' */
    filter?: 'nearest' | 'linear',
    /** default 'clamp' */
    wrap?: 'clamp' | 'repeat' | 'mirror',
    /** default false */
    mipmaps?: boolean,
    /** flip images vertically on upload (default false) */
    flipY?: boolean,
    /** default false */
    premultiplyAlpha?: boolean,
    /** data textures: default gl.RGBA8 */
    internalFormat?: number,
    /** data textures: default gl.RGBA */
    format?: number,
    /** data textures: default gl.UNSIGNED_BYTE */
    type?: number,
}

/**
 * Raw texture contents (or just a size) for {@link CreateTexture} and {@link UpdateTexture}.
 *
 * @category WebGL
 */
export interface TextureData {
    /** pixels */
    width: number,
    /** pixels */
    height: number,
    /** null / undefined = allocate only (e.g. render targets) */
    data?: ArrayBufferView | null,
}

/**
 * A 2D texture with its size, from {@link CreateTexture}. Can be passed directly as a sampler uniform.
 *
 * @category WebGL
 */
export interface TextureInfo {
    /** the texture object */
    texture: WebGLTexture,
    /** pixels, as of the last upload */
    width: number,
    /** pixels, as of the last upload */
    height: number,
    /** a copy of the options it was created with, reused by {@link UpdateTexture} */
    options: TextureOptions,
}

const sourceSize = (source: TexImageSource): [number, number] => {
    const s = source as { naturalWidth?: number, naturalHeight?: number, videoWidth?: number, videoHeight?: number, width: number, height: number };

    return [s.naturalWidth || s.videoWidth || s.width, s.naturalHeight || s.videoHeight || s.height];
};

function uploadTexture(gl: WebGL2RenderingContext, info: TextureInfo, source: TexImageSource | TextureData): void {
    const o = info.options;

    gl.bindTexture(gl.TEXTURE_2D, info.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, o.flipY ?? false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, o.premultiplyAlpha ?? false);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); // rows of any width

    if (!isImageSource(source)) {
        const data = source as TextureData;

        info.width = data.width;
        info.height = data.height;

        gl.texImage2D(gl.TEXTURE_2D, 0, o.internalFormat ?? gl.RGBA8, data.width, data.height, 0, o.format ?? gl.RGBA, o.type ?? gl.UNSIGNED_BYTE, data.data ?? null);
    } else {
        [info.width, info.height] = sourceSize(source as TexImageSource);

        gl.texImage2D(gl.TEXTURE_2D, 0, o.internalFormat ?? gl.RGBA8, o.format ?? gl.RGBA, o.type ?? gl.UNSIGNED_BYTE, source as TexImageSource);
    }

    if (o.mipmaps) gl.generateMipmap(gl.TEXTURE_2D);

    gl.bindTexture(gl.TEXTURE_2D, null);
}

// images, canvases, videos, bitmaps, ImageData: anything texImage2D takes directly
function isImageSource(source: unknown): boolean {
    for (const name of ['HTMLImageElement', 'HTMLCanvasElement', 'HTMLVideoElement', 'ImageBitmap', 'ImageData', 'OffscreenCanvas', 'VideoFrame']) {
        const type = (globalThis as Record<string, unknown>)[name] as (abstract new (...args: never[]) => unknown) | undefined;

        if (type && source instanceof type) return true;
    }

    return false;
}

/**
 * Creates a 2D texture from an image / canvas / video / bitmap, or from raw data.
 *
 * @category WebGL
 */
export function CreateTexture(gl: WebGL2RenderingContext, source: TexImageSource | TextureData, options: TextureOptions = {}): TextureInfo {
    const texture = gl.createTexture();

    if (!texture) throw new Error('CreateTexture: could not create a texture (context lost?)');

    const info: TextureInfo = { texture, width: 0, height: 0, options: { ...options } };

    const nearest = options.filter === 'nearest';
    const wrap = options.wrap === 'repeat' ? gl.REPEAT : options.wrap === 'mirror' ? gl.MIRRORED_REPEAT : gl.CLAMP_TO_EDGE;
    const minFilter = options.mipmaps
        ? (nearest ? gl.NEAREST_MIPMAP_NEAREST : gl.LINEAR_MIPMAP_LINEAR)
        : (nearest ? gl.NEAREST : gl.LINEAR);

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, nearest ? gl.NEAREST : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);

    uploadTexture(gl, info, source);

    return info;
}

/**
 * Re-uploads a texture's contents (the size may change); regenerates mipmaps if it has them.
 *
 * @category WebGL
 */
export function UpdateTexture(gl: WebGL2RenderingContext, info: TextureInfo, source: TexImageSource | TextureData): void {
    uploadTexture(gl, info, source);
}

/**
 * Loads an image from a URL into a texture.
 *
 * @category WebGL
 */
export function LoadWebGlTexture(gl: WebGL2RenderingContext, url: string, options: TextureOptions = {}): Promise<TextureInfo> {
    const image = new Image();

    image.crossOrigin = 'anonymous';
    image.src = url;

    return image.decode().then(() => CreateTexture(gl, image, options));
}

/**
 * Deletes the texture.
 *
 * @category WebGL
 */
export function DeleteTexture(gl: WebGL2RenderingContext, info: TextureInfo): void {
    gl.deleteTexture(info.texture);
}

// ---- render targets ----

/**
 * An offscreen framebuffer with a color texture, from {@link CreateRenderTarget}.
 *
 * @category WebGL
 */
export interface RenderTarget {
    /** the framebuffer object */
    framebuffer: WebGLFramebuffer,
    /** the color output; use it as a sampler uniform */
    texture: TextureInfo,
    /** the DEPTH24_STENCIL8 renderbuffer, unless created with `depth: false` */
    depth?: WebGLRenderbuffer,
    /** pixels */
    width: number,
    /** pixels */
    height: number,
}

/**
 * Options for {@link CreateRenderTarget}: the color texture's options, plus `depth`.
 *
 * @category WebGL
 */
export interface RenderTargetOptions extends Omit<TextureOptions, 'mipmaps' | 'flipY' | 'premultiplyAlpha'> {
    /** depth (and stencil) attachment. Default true. */
    depth?: boolean,
}

/**
 * An offscreen framebuffer with a color texture (and depth), for render-to-texture and post-processing.
 *
 * @category WebGL
 */
export function CreateRenderTarget(gl: WebGL2RenderingContext, width: number, height: number, options: RenderTargetOptions = {}): RenderTarget {
    const texture = CreateTexture(gl, { width, height }, options);
    const framebuffer = gl.createFramebuffer();

    if (!framebuffer) throw new Error('CreateRenderTarget: could not create a framebuffer (context lost?)');

    const target: RenderTarget = { framebuffer, texture, width, height };
    const previous = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture.texture, 0);

    if (options.depth ?? true) {
        target.depth = gl.createRenderbuffer() ?? undefined;
        gl.bindRenderbuffer(gl.RENDERBUFFER, target.depth ?? null);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH24_STENCIL8, width, height);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, target.depth ?? null);
        gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    }

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);

    gl.bindFramebuffer(gl.FRAMEBUFFER, previous); // leave whatever target was bound in place

    if (status !== gl.FRAMEBUFFER_COMPLETE) {
        DeleteRenderTarget(gl, target);
        throw new Error(`CreateRenderTarget: framebuffer incomplete (0x${status.toString(16)}); is this format renderable?`);
    }

    return target;
}

/**
 * Reallocates the target's color texture (and depth buffer) at a new size, discarding their contents. Does nothing if the size is unchanged.
 *
 * @category WebGL
 */
export function ResizeRenderTarget(gl: WebGL2RenderingContext, target: RenderTarget, width: number, height: number): void {
    if (target.width === width && target.height === height) return;

    target.width = width;
    target.height = height;

    UpdateTexture(gl, target.texture, { width, height });

    if (target.depth) {
        gl.bindRenderbuffer(gl.RENDERBUFFER, target.depth);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH24_STENCIL8, width, height);
        gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    }
}

/**
 * Draws into `target` (or the canvas, with null) and sets the viewport to match.
 *
 * @category WebGL
 */
export function BindRenderTarget(gl: WebGL2RenderingContext, target: RenderTarget | null): void {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target?.framebuffer ?? null);
    gl.viewport(0, 0, target?.width ?? gl.drawingBufferWidth, target?.height ?? gl.drawingBufferHeight);
}

/**
 * Deletes the framebuffer, its color texture and its depth buffer.
 *
 * @category WebGL
 */
export function DeleteRenderTarget(gl: WebGL2RenderingContext, target: RenderTarget): void {
    gl.deleteFramebuffer(target.framebuffer);
    DeleteTexture(gl, target.texture);
    if (target.depth) gl.deleteRenderbuffer(target.depth);
}

// ---- drawing ----

/**
 * Options for {@link Draw}.
 *
 * @category WebGL
 */
export interface DrawOptions {
    /** default gl.TRIANGLES */
    mode?: number,
    /** vertices (or indices); default: the vertex array's count */
    count?: number,
    /** first vertex (or index) */
    offset?: number,
    /** > 0: instanced draw */
    instances?: number,
    /** set with {@link SetUniforms} before drawing */
    uniforms?: Record<string, UniformValue>,
}

/**
 * Draws a vertex array with a program; indexed and instanced draws are picked automatically.
 *
 * @category WebGL
 */
export function Draw(gl: WebGL2RenderingContext, info: ProgramInfo, vertexArray: VertexArrayInfo, options: DrawOptions = {}): void {
    const mode = options.mode ?? gl.TRIANGLES;
    const count = options.count ?? vertexArray.count;
    const offset = options.offset ?? 0;
    const instances = options.instances ?? 0;

    if (count === undefined) throw new Error('Draw: no count given and the vertex array has none');

    gl.useProgram(info.program);
    if (options.uniforms) SetUniforms(gl, info, options.uniforms);

    gl.bindVertexArray(vertexArray.vao);

    if (vertexArray.indexBuffer !== undefined) {
        const type = vertexArray.indexType ?? gl.UNSIGNED_SHORT;
        const byteOffset = offset * (type === gl.UNSIGNED_INT ? 4 : type === gl.UNSIGNED_BYTE ? 1 : 2);

        if (instances > 0) gl.drawElementsInstanced(mode, count, type, byteOffset, instances);
        else gl.drawElements(mode, count, type, byteOffset);
    } else if (instances > 0) {
        gl.drawArraysInstanced(mode, offset, count, instances);
    } else {
        gl.drawArrays(mode, offset, count);
    }

    gl.bindVertexArray(null);
}
