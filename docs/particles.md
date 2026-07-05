# Particle Life

`import { ... } from "@n3rdw1z4rd/core";` (the 3D variant also lives under `@n3rdw1z4rd/core/three`)

"Particle life" is an emergent-behavior simulation: particles are assigned one of a handful of colors, and a randomized per-color-pair attraction matrix determines whether same/different-colored particles attract or repel at short range. The result is swarming/clustering behavior that looks alive despite a very simple update rule. This package has both a 2D (canvas) and 3D (Three.js) implementation, sharing the same force model.

## Color

A mutable RGBA color class (0-255 channels), with hex string get/set and a few named-color statics.

```ts
class Color {
    r: number; g: number; b: number; a: number; // each clamped to [0, 255] on set
    hexStr: string; // get/set as '#rrggbbaa'
    readonly rgba: number[];

    constructor(r?: string | number, g?: number, b?: number, a?: number); // r can be a hex string instead

    static fromHsv(h: number, s: number, v: number, a?: number): Color;
    static fromName(name: string): Color; // resolves any CSS color name via a throwaway DOM element

    static get BLACK/GRAY/WHITE/RED/GREEN/BLUE/YELLOW/ORANGE/PURPLE/CYAN/MAGENTA/TRANSPARENT(): Color;
}
```

## SpatialPartition2d / SpatialPartition3d

Uniform-grid spatial partitioning so the particle simulations only check nearby neighbors instead of doing all-pairs force calculation. Both operate on a **unit** [0,1] (or [0,1]^3) coordinate space with wraparound neighbor lookups.

```ts
interface SpatialPartitionEntity2d { x: number; y: number; }
class SpatialPartition2d {
    constructor(cellSize: number, entities: SpatialPartitionEntity2d[]);
    cells: SpatialPartitionEntity2d[][][];
    getCell(x: number, y: number): SpatialPartitionEntity2d[];
    getCellNeighbors(x: number, y: number): SpatialPartitionEntity2d[][]; // 3x3 neighborhood, wraps at edges
    addEntity(entity: SpatialPartitionEntity2d): void;
}

interface SpatialPartitionEntity3d { x: number; y: number; z: number; }
class SpatialPartition3d {
    constructor(cellSize: number, entities: SpatialPartitionEntity3d[]);
    cells: SpatialPartitionEntity3d[][][][];
    getCell(x: number, y: number, z: number): SpatialPartitionEntity3d[];
    getCellNeighbors(cx: number, cy: number, cz: number): SpatialPartitionEntity3d[][]; // 3x3x3, wraps at edges
    addEntity(entity: SpatialPartitionEntity3d): void;
}
```

Note `getCell`/`getCellNeighbors` take different argument meanings between the two: 2D's `getCellNeighbors` takes grid coordinates just like `getCell` does; 3D's already expects cell indices (`cx`/`cy`/`cz`), not world positions.

## particle-renderer (ParticleRenderer)

A double-buffered 2D canvas renderer purpose-built for per-pixel particle drawing (distinct from `rendering/canvas-renderer.ts`'s `CanvasRenderer`, which is a general shape/text drawing API). Both files now live under `src/rendering/`.

```ts
class ParticleRenderer {
    readonly width: number;
    readonly height: number;
    screenContext: CanvasRenderingContext2D;
    bufferContext: OffscreenCanvasRenderingContext2D;

    constructor(canvas?: HTMLCanvasElement);
    appendTo(target: HTMLElement, autoResize?: boolean): void;
    resize(displayWidth?: number, displayHeight?: number): boolean;
    setPixel(x: number, y: number, color: Color, size?: number): void; // draws into the offscreen buffer
    render(): void; // blits the buffer to the screen canvas, then clears the buffer
}
```

(Note: this class was named `Renderer` in earlier versions of this package - if you're upgrading, update any type annotations that referenced `Renderer` directly.)

## ParticleSystem2d

```ts
class ParticleSystem2d {
    readonly particleCount: number; // 2000

    constructor();
    update(renderer: ParticleRenderer, dt: number): void; // updates physics AND draws via renderer.setPixel
}
```

```ts
import { ParticleSystem2d, ParticleRenderer } from "@n3rdw1z4rd/core";

const renderer = new ParticleRenderer();
renderer.appendTo(document.body);

const particles = new ParticleSystem2d();

function loop(dt: number) {
    particles.update(renderer, dt);
    renderer.render();
}
```

## ParticleSystem3d (`@n3rdw1z4rd/core/three`)

Same force model, rendered as a Three.js `Points` cloud inside a `Group` you add to your scene. Colors are hard-coded (not the `Color` class) and rendered via a small custom `ShaderMaterial`.

```ts
class ParticleSystem3d extends Group {
    readonly particleCount: number; // 1000

    constructor();
    update(camera: PerspectiveCamera, dt: number): void; // camera is used only to depth-sort particles for blending
}
```

```ts
import { ParticleSystem3d } from '@n3rdw1z4rd/core/three';

const particles = new ParticleSystem3d();
scene.add(particles);

function loop(dt: number) {
    particles.update(camera, dt);
}
```

Both simulations use the same tunable constants internally (friction half-life, interaction range, force scale) and a randomized attraction matrix from `rng.randomMatrix(colorCount)` generated fresh each time you construct one - there's no shared seed control between separate instances beyond whatever `rng.seed` was set to beforehand.
