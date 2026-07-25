# @n3rdw1z4rd/core

A personal, browser-facing TypeScript toolkit consolidated out of several game/graphics side projects: math and RNG with no native `Math` dependency, an event emitter (TODO: emitter replaced), two ECS flavors, procedural generation (pathfinding, Poisson-disk sampling, dungeon layout), a "particle life" simulation in 2D and 3D, and a set of Three.js helpers (camera rig, bootstrap scene, voxel meshing, texture atlases, procedural meshes).

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

clock.onFrame.subscribe((dt) => {
    // dt is seconds since last frame
});

clock.start();
```

Everything (including the `three/*` modules) is re-exported from the package root, so `import { ThreeJsBoilerPlate } from "@n3rdw1z4rd/core"` works. Import from the `three` subpath if you want to make the Three.js dependency explicit in your own code:

```ts
import { ThreeJsBoilerPlate } from "@n3rdw1z4rd/core/three";
```
