export enum ShaderType {
    VERTEX = WebGL2RenderingContext.VERTEX_SHADER,
    FRAGMENT = WebGL2RenderingContext.FRAGMENT_SHADER,
}

export type ProgramLocations = { attributes: KeyValue, uniforms: KeyValue };
export type ProgramInfo = { program: WebGLProgram, attributes: KeyValue, uniforms: KeyValue };
export type Color = [number, number, number, number];

export function CreateWebGlContext(canvas?: HTMLCanvasElement): WebGL2RenderingContext {
    return (canvas ?? document.createElement('canvas')).getContext('webgl2')!;
}

export function ResizeWebGlContext(
    gl: WebGL2RenderingContext,
    displayWidth?: number,
    displayHeight?: number,
): boolean {
    const canvas = gl.canvas as HTMLCanvasElement;

    const { width, height } = (
        canvas.parentElement?.getBoundingClientRect() ??
        canvas.getBoundingClientRect()
    );

    displayWidth = (0 | (displayWidth ?? width));
    displayHeight = (0 | (displayHeight ?? height));

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        gl.canvas.width = displayWidth
        gl.canvas.height = displayHeight;
        gl.viewport(0, 0, displayWidth, displayHeight);

        return true;
    }

    return false;
}

export function CompileShader(gl: WebGL2RenderingContext, type: ShaderType, source: string): WebGLShader {
    const shader: WebGLShader = gl.createShader(type)!;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw `CompileShader: failed to compile shader: ${gl.getShaderInfoLog(shader)}`;
    }

    return shader;
}

export function CreateProgram(gl: WebGL2RenderingContext, vertexShader: WebGLShader | string, fragmentShader: WebGLShader | string): WebGLProgram {
    if (typeof vertexShader === 'string') {
        vertexShader = CompileShader(gl, ShaderType.VERTEX, vertexShader) as WebGLShader;
    }

    if (typeof fragmentShader === 'string') {
        fragmentShader = CompileShader(gl, ShaderType.FRAGMENT, fragmentShader) as WebGLShader;
    }

    const program: WebGLProgram = gl.createProgram()!;

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw `CreateProgram: failed to link program: ${gl.getProgramInfoLog(program)}`;
    }

    return program;
}

export function GetProgramLocations(gl: WebGL2RenderingContext, program: WebGLProgram): ProgramLocations {
    const attributes: KeyValue = {};
    const attributeCount = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);

    for (let i = 0; i < attributeCount; i++) {
        const info = gl.getActiveAttrib(program, i)!;
        attributes[info.name] = gl.getAttribLocation(program, info.name);
    }

    const uniforms: KeyValue = {};
    const uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);

    for (let i = 0; i < uniformCount; i++) {
        const info = gl.getActiveUniform(program, i)!;
        uniforms[info.name] = gl.getUniformLocation(program, info.name);
    }

    return { attributes, uniforms } as ProgramLocations;
}

export function CreateProgramInfo(gl: WebGL2RenderingContext, vertexShaderSource: string, fragmentShaderSource: string): ProgramInfo {
    const program: WebGLProgram = CreateProgram(
        gl, vertexShaderSource, fragmentShaderSource
    );

    const locations: KeyValue = GetProgramLocations(gl, program);

    return { program, ...locations } as ProgramInfo;
}
