# 2D & Raw WebGL Rendering

`import { ... } from "@n3rdw1z4rd/core";`

These are the non-Three.js rendering helpers - for a game/scene that either draws with plain Canvas2D shapes or hand-rolled WebGL2, without pulling in Three.js at all.

## CanvasRenderer

A general-purpose 2D canvas drawing API (rects, pixels, lines, circles, text) - distinct from [`particle-renderer.ts`'s `ParticleRenderer`](particles.md), which is specialized for per-pixel particle drawing.

```ts
type CanvasColor = string | CanvasGradient | CanvasPattern;

interface DrawParams {
    color?: CanvasColor;         // used for both stroke and fill unless overridden below
    strokeColor?: CanvasColor;   // overrides color for the stroke
    fillColor?: CanvasColor;     // overrides color for the fill
    filled?: boolean;            // default false (stroke-only)
    size?: number;                // line width for shapes, font size (px) for text
    fontName?: string;
    textAlign?: CanvasTextAlign;
    textBaseline?: CanvasTextBaseline;
    lineDash?: number[];
}

class CanvasRenderer {
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D;
    drawCentered: boolean; // default true - x/y is the shape's center, not its top-left/start
    readonly width: number; readonly height: number;

    constructor(canvas?: HTMLCanvasElement);
    appendTo(target: HTMLElement): void;
    resize(displayWidth?: number, displayHeight?: number): boolean;
    clear(): void;
    drawRect(x: number, y: number, width: number, height: number, params?: DrawParams): void;
    drawPixel(x: number, y: number, params?: DrawParams): void;   // a small filled square; size = side length
    drawLine(x1: number, y1: number, x2: number, y2: number, params?: DrawParams): void;
    drawCircle(x: number, y: number, radius: number, params?: DrawParams): void;
    drawText(x: number, y: number, text: string, params?: DrawParams): void;
}
```

```ts
import { CanvasRenderer } from "@n3rdw1z4rd/core";

const renderer = new CanvasRenderer();
renderer.appendTo(document.body);

renderer.drawCircle(100, 100, 20, { color: 'cyan', filled: true });
renderer.drawLine(0, 0, 100, 100, { color: 'white', lineDash: [4, 4] });
renderer.drawText(50, 50, 'hello', { color: 'white', size: 16 });
```

Coordinates and sizes are plain numbers, not tuples. `drawCentered` (default `true`) affects `drawRect`/`drawPixel`, which are positioned by center rather than top-left corner by default - set it to `false` if you want top-left-anchored placement instead.

## Raw WebGL2 helpers (`rendering/webgl.ts`)

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
