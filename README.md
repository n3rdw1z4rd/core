# @n3rdw1z4rd/core

A personal, browser-facing TypeScript toolkit consolidated out of several game/graphics side projects: math and RNG with no native `Math` dependency, an event emitter, two ECS flavors, procedural generation (pathfinding, Poisson-disk sampling, dungeon layout), a "particle life" simulation in 2D and 3D, and a set of Three.js helpers (camera rig, bootstrap scene, voxel meshing, texture atlases, procedural meshes).

Nothing here is trying to be a general-purpose framework - it's the shared plumbing that kept getting copy-pasted between projects, pulled into one place so it only has to be fixed once.

## Install

```
npm install @n3rdw1z4rd/core
```

Peer dependencies (install whichever your project actually uses):

```
npm install three simplex-noise
```

`three` is only required if you import from `@n3rdw1z4rd/core/three` (or the top-level barrel, which re-exports it). `simplex-noise` is required for `Noise` and `AsteroidMesh`.

This package ships both CJS and ESM builds plus `.d.ts` types (built with `tsup`). It targets the browser - most modules touch `window`, `document`, or `HTMLCanvasElement`.

## Quick start

```ts
import { rng, clamp, log, Clock } from "@n3rdw1z4rd/core";

log(rng.range(0, 10));   // random int in [0, 10)
log(clamp(15, 0, 10));   // 10

const clock = new Clock();
clock.on('frame', (dt) => {
    // dt is seconds since last frame
});
clock.start();
```

Everything (including the `three/*` modules) is re-exported from the package root, so `import { ThreeJsBoilerPlate } from "@n3rdw1z4rd/core"` works. Import from the `three` subpath if you want to make the Three.js dependency explicit in your own code:

```ts
import { ThreeJsBoilerPlate } from "@n3rdw1z4rd/core/three";
```

## What's in here

| Area | Docs | Summary |
|---|---|---|
| Math & RNG | [docs/math-and-rng.md](docs/math-and-rng.md) | Pure-math `sin`/`cos`/`floor`/etc. (no native `Math` calls), a seeded `RandomNumberGenerator` class with an exclusive `range()`, gaussian sampling, shuffling. |
| Events | [docs/events.md](docs/events.md) | `Emitter` (typed on/emit/clear), `EventBus` (DOM `CustomEvent`-based, for cross-module pub/sub without a shared instance). |
| ECS | [docs/ecs.md](docs/ecs.md) | Two independent designs: a component-template-registry singleton (`ECS.instance`), and an Object3D-based variant under `three/ecs.ts` where components live in `userData`. |
| Clock, logging, input | [docs/clock-logging-input.md](docs/clock-logging-input.md) | `Clock` (rAF loop + FPS/dt tracking, emits a `'frame'` event), leveled console loggers, `Input` (keyboard/mouse event normalization). |
| Noise | [docs/noise.md](docs/noise.md) | `Noise` (2D/3D/4D + fractal/fBm, wraps the `simplex-noise` package), plus a self-contained `SimplexNoise` class. |
| 2D primitives | [docs/2d-primitives.md](docs/2d-primitives.md) | `Vector`, `Rectangle`, `Map2D`/`Map3D` (sparse coordinate maps), `Tilemap<T>`. |
| Procedural generation | [docs/procedural-generation.md](docs/procedural-generation.md) | `AStar` pathfinding, `PoissonDiskSampler`, and a full room-based dungeon generator (`GenerateRooms`/`GenerateDoors`/`GenerateWalls`). |
| Particle life | [docs/particles.md](docs/particles.md) | 2D (canvas) and 3D (Three.js `Points`) "particle life" attraction-matrix simulations, `Color`, `SpatialPartition2d`/`3d`. |
| 2D/WebGL rendering | [docs/rendering-2d-webgl.md](docs/rendering-2d-webgl.md) | `CanvasRenderer` (shape/text drawing), and a thin raw-WebGL2 helper layer (`CreateWebGlContext`, shader/program helpers, `WebGlRenderer`). |
| Three.js bootstrap | [docs/threejs-bootstrap.md](docs/threejs-bootstrap.md) | `ThreeJsBoilerPlate` (scene/camera/renderer/input wiring), `ThreeJsCameraRig` (hand-rolled orbit rig) vs. opt-in `OrbitControls`, `ThreeJsPlayerController`. |
| Three.js meshes & textures | [docs/threejs-meshes-and-textures.md](docs/threejs-meshes-and-textures.md) | `VoxelMesh` (per-face-culled voxel geometry + palettes), `TextureAtlas`/`AtlasTextureMaterial`, `CubeSphereGeometry`, `AsteroidMesh`, starfield generators. |
| Three.js widgets | [docs/threejs-widgets.md](docs/threejs-widgets.md) | `CreatePaletteController`, a lil-gui color-swatch widget for picking a palette index. |
| Networking | [docs/networking.md](docs/networking.md) | `WorkerInterface`, a thin `Emitter`-based wrapper around `Worker`. |
| Misc | [docs/misc.md](docs/misc.md) | A couple of small standalone helpers: `isNullOrUndefined`, `getRedYellowGreenGradientHex`. |

## Design notes worth knowing before you dig in

- **Two ECS designs, on purpose.** The top-level `ECS` (in `ecs.ts`) is a component-template-registry singleton (`ECS.instance.createComponent(...)`). The Three.js-flavored one (`three/ecs.ts`) stores components directly on an `Object3D`'s `userData`, so the scene graph doubles as the entity list. Pick whichever fits a given project - they don't interoperate and aren't meant to.
- **Two camera-control approaches, both supported.** `ThreeJsBoilerPlate.enableCameraRigControls()` uses the hand-rolled `ThreeJsCameraRig` (orbit/dolly driven by `Input` events). `enableOrbitControls()` uses Three's own `OrbitControls` instead. They're mutually exclusive - call one or the other, not both.
- **`rng.range(min, max)` is exclusive of `max`.** If you're carrying over code from an older version of this package (pre-0.12), note this changed from inclusive to exclusive.
- **No native `Math` calls in `math.ts`.** `sin`/`cos`/`floor`/`ceil`/`round`/`sqrt` etc. are all reimplemented from scratch (Taylor series + quadrant reduction for trig, accurate to ~4.65e-7). Everything else in the package builds on these rather than calling `Math.*` directly, with a few explicitly-commented pragmatic exceptions (e.g. `rng.parkMillerNormal()` uses native `Math.log`).
- **No `gl-matrix` dependency, and no `VEC2`/`VEC3`/`VEC4` types (as of 0.14).** `Input.mousePosition`/`mousePosition2`, `CanvasRenderer`'s draw methods, `TextureAtlas.getUv`, and `RandomNumberGenerator.randomUnitVector` used to return `gl-matrix`'s `vec2`/`vec4` (`Float32Array`-backed at runtime, 32-bit float precision). They now return plain `[number, number]`/`[number, number, number, number]` tuples inline - full double precision, no longer `instanceof Float32Array`, and no named vector type at all. If you're upgrading from an older version and relied on any of that, this is a breaking change.
- **`Rng` was renamed to `RandomNumberGenerator`.** The shared instance is still exported as `rng`, but the class type itself is `RandomNumberGenerator` now, not `Rng`. Update any type annotations that referenced `Rng` directly.
