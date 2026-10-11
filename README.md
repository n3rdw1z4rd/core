# @n3rdw1z4rd/core

A personal, browser-facing TypeScript toolkit consolidated out of several game/graphics side projects: math helpers and a deterministic, seedable RNG, an event emitter (TODO: emitter replaced), two ECS flavors, procedural generation (pathfinding, dungeon layout), a "particle life" simulation in 2D and 3D, raw WebGL helpers, and a set of Three.js helpers (camera rigs, voxel meshing, texture atlases, procedural meshes).

Nothing here is trying to be a general-purpose framework - it's the shared plumbing that kept getting copy-pasted between projects, pulled into one place so it only has to be fixed once.

## Install

```
npm install @n3rdw1z4rd/core
```

The Three.js helpers live in their own entry point, `@n3rdw1z4rd/core/three`, and need `three` (an optional peer dependency):

```
npm install three
```

The package root (`@n3rdw1z4rd/core`) never imports `three`, so projects that don't use Three.js don't need it installed.

Core has no noise implementation of its own. `AsteroidMesh` and `CubeSphereGeometry.applyFractalBrownianMotion` take a noise function, e.g. from [`simplex-noise`](https://www.npmjs.com/package/simplex-noise):

```ts
import { createNoise3D } from "simplex-noise";
import { rng } from "@n3rdw1z4rd/core";
import { AsteroidMesh } from "@n3rdw1z4rd/core/three";

const asteroid = new AsteroidMesh({ noise3d: createNoise3D(() => rng.nextFloat()) });
```

This package ships ESM and CJS builds plus `.d.ts` types (built with `tsup`). The ESM build is tree-shakable: bundlers only include the modules you actually import.

### Browser vs. Node

The data and logic modules load and run anywhere, including Node (the tests run there): math, `Random`/`Rng`, `Vector`, `Rectangle`, `Map2D`/`Map3D`/`Tilemap`, `AStar`, the dungeon generator, `ECS`, the event helpers (`Emitter`, `Observable`, `Signal`, `EventQueue`, `Disposable`), `Color` and color palettes, the spatial partitions and the particle simulations.

These need a browser when used (importing them is still safe anywhere): `CanvasRenderer`, `ParticleRenderer`, `WebGlRenderer` and the WebGL helpers, `Input`, `WorkerInterface`, `Clock.start()`, `Color.fromName()` and `GetUrlParams()`, plus anything in `@n3rdw1z4rd/core/three` that renders or loads textures.

## Quick start

```ts
import { rng, clamp, log, Clock } from "@n3rdw1z4rd/core";

log(rng.range(0, 10));   // random int in [0, 10)
log(clamp(15, 0, 10));   // 10

const clock = new Clock();

clock.onFrame.subscribe((dt) => {
    // dt is seconds since last frame
});

clock.start();
```

Three.js helpers come from the `three` subpath:

```ts
import { CameraRig } from "@n3rdw1z4rd/core/three";
```

The optional stylesheet (reset + dark defaults) is shipped as plain CSS:

```ts
import "@n3rdw1z4rd/core/css/main.css";
```

## Development

```
npm run build          # tsup -> dist/: ESM (one file per module), CJS (index + three), .d.ts
npm test               # regression tests (run in Node)
npm test -- astar      # also draws the visual A* demo in the terminal
```
