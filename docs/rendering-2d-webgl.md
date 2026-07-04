# 2D & Raw WebGL Rendering

`import { ... } from "@n3rdw1z4rd/core";`

These are the non-Three.js rendering helpers - for a game/scene that either draws with plain Canvas2D shapes or hand-rolled WebGL2, without pulling in Three.js at all.

## CanvasRenderer

A general-purpose 2D canvas drawing API (points, boxes, lines, text) - distinct from [`particle-renderer.ts`'s `Renderer`](particles.md), which is specialized for per-pixel particle drawing.

```ts
interface DrawParams {
    radius?: number;
    fill?: boolean;
    color?: string | CanvasGradient | CanvasPattern;
}

class CanvasRenderer {
    ctx: CanvasRenderingContext2D;
    clearColor: string | CanvasGradient | CanvasPattern;
    fontName: string; fontSize: number;
    textAlign: CanvasTextAlign; textBaseline: CanvasTextBaseline;
    readonly width: number; readonly height: number; readonly center: [number, number];

    constructor(canvas?: HTMLCanvasElement);
    appendTo(target?: HTMLElement, autoResize?: boolean): void;
    resize(displayWidth?: number, displayHeight?: number): boolean;
    clear(): void;
    drawPoint(xy: [number, number], params?: DrawParams): void;
    drawBox(xy: [number, number], wh: [number, number], params?: DrawParams): void;
    drawLine(x1y1x2y2: [number, number, number, number], color?: string): void;
    drawText(text: string, xy: [number, number], color?: string, size?: number, font?: string): void;
}
```

Coordinates and sizes are plain tuples - no vector-math library required.

## Raw WebGL2 helpers (`renderer/webgl.ts`)

Thin functional wrappers around the WebGL2 boilerplate you'd otherwise repeat in every project: context creation, shader compilation, program linking, and attribute/uniform location lookup.

```ts
enum ShaderType { VERTEX, FRAGMENT }
type ProgramLocations = { attributes: KeyValue, uniforms: KeyValue };
type ProgramInfo = { program: WebGLProgram, attributes: KeyValue, uniforms: KeyValue };

function CreateWebGlContext(canvas?: HTMLCanvasElement): WebGL2RenderingContext;
function ResizeWebGlContext(gl: WebGL2RenderingContext, displayWidth?: number, displayHeight?: number): boolean;
function CompileShader(gl: WebGL2RenderingContext, type: ShaderType, source: string): WebGLShader;
function CreateProgram(gl: WebGL2RenderingContext, vertexShader: WebGLShader | string, fragmentShader: WebGLShader | string): WebGLProgram;
function GetProgramLocations(gl: WebGL2RenderingContext, program: WebGLProgram): ProgramLocations;
function CreateProgramInfo(gl: WebGL2RenderingContext, vertexShaderSource: string, fragmentShaderSource: string): ProgramInfo;
```

`CompileShader`/`CreateProgram` throw a plain string (not an `Error`) on compile/link failure, including the driver's info log - wrap calls in try/catch if you need structured error handling.

```ts
import { CreateProgramInfo } from "@n3rdw1z4rd/core";

const { program, attributes, uniforms } = CreateProgramInfo(gl, vertexSource, fragmentSource);
gl.useProgram(program);
gl.enableVertexAttribArray(attributes.position);
```

## WebGlRenderer

A minimal renderer shell around `CreateWebGlContext` - currently just handles canvas creation, resize, and DOM attachment; `render()` is a stub you're expected to extend (it checks for `this.programInfo` but doesn't do anything with it yet).

```ts
interface RendererParams { canvas?: HTMLCanvasElement, parent?: HTMLElement }

class WebGlRenderer {
    gl: WebGL2RenderingContext;
    programInfo: ProgramInfo | undefined;
    readonly canvas: HTMLCanvasElement;
    readonly width: number; readonly height: number;

    constructor();
    appendTo(htmlElement?: HTMLElement): void;
    resize(displayWidth?: number, displayHeight?: number): boolean;
    render(deltaTime: number): void; // currently a no-op stub - extend or replace
}
```

Treat `WebGlRenderer` as a starting skeleton rather than a finished renderer - most projects will want to subclass it or copy the resize/attach logic into something more specific.
