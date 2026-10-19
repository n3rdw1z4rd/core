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

This package ships ESM and CJS builds plus `.d.ts` types (built with `tsdown`). The ESM build is tree-shakable: bundlers only include the modules you actually import.

### Browser vs. Node

The data and logic modules load and run anywhere, including Node (the tests run there): math, `Random`/`Rng`, `Vector`, `Rectangle`, `Map2D`/`Map3D`/`Tilemap`, `findPath` (A*), the dungeon generator, `ECS`, the event helpers (`Emitter`, `Observable`, `Signal`, `EventQueue`, `Disposable`), `Color` and color palettes, the spatial partitions and the particle simulations.

These need a browser when used (importing them is still safe anywhere): `CanvasRenderer`, `ParticleRenderer`, `WebGlRenderer` and the WebGL helpers, `Input`, `InputActionMap`, `WorkerInterface`, `Clock.start()`, `Color.fromName()` and `GetUrlParams()`, plus anything in `@n3rdw1z4rd/core/three` that renders or loads textures.

## Quick start

```ts
import { rng, clamp, log, Clock } from "@n3rdw1z4rd/core";

log(rng.range(0, 10));   // random int in [0, 10)
log(clamp(15, 0, 10));   // 10

const clock = new Clock();

clock.start((dt) => {
    // dt is seconds since the last frame (capped at clock.maxDeltaTime, 0.1 by default)
    // clock.fps and clock.elapsedTime are also available
});
```

When something else drives the loop (e.g. Three.js), advance the clock yourself:

```ts
renderer.setAnimationLoop((time) => {
    const dt = clock.tick(time);
    renderer.render(scene, camera);
});
```

`Input` is event-based and needs no frame loop, so it suits apps, editors and turn-based games alike:

```ts
import { Input } from "@n3rdw1z4rd/core";

const input = Input.instance;
input.target = canvas;   // pointer positions are measured on it (keys are always read from window)

input.on("keyw_down", "arrowup_down", () => move(0, -1));
input.on("space_pressed", wait);   // released within inputThreshold ms
input.on("button0_clicked", () => select(input.pointerPosition));   // not after a drag
input.on("pointer_move", () => {
    if (input.isButtonDown(0)) pan(input.pointerDelta.x, input.pointerDelta.y);
});
input.on("mouse_wheel", (ev: WheelEvent) => zoom(ev.deltaY));
```

`InputActionMap` adds a Godot-style action map on top, for games that read input once per frame: game code asks about actions rather than keys or buttons.

```ts
import { InputActionMap, key, pad, padAxis, gesture, xr } from "@n3rdw1z4rd/core";

const controls = new InputActionMap();   // reads Input.instance; includes ui_accept, ui_cancel, ui_left, ... defaults

controls.actions.add("jump", [key("Space"), pad("A"), gesture("tap"), xr("right", "primary")]);
controls.actions.add("move_left", [key("KeyA"), padAxis("leftX", -1)]);
// ... move_right, move_forward, move_back

// once per frame, before game logic
controls.update();

if (controls.isActionJustPressed("jump")) player.jump();
const move = controls.getVector("move_left", "move_right", "move_forward", "move_back");
```

Keyboard, mouse and pen, touch gestures, gamepads (each its own device for local multiplayer) and WebXR controllers (`controls.attachXR(session)`) all feed the same actions. `repeat` keeps a held action pressing again like a held key in a text field (`{ repeat: true }`; the `ui_*` directions repeat by default), `controls.gestures.events` says where the last frame's taps and swipes happened, `controls.actions.toJSON()` / `load()` save rebinds, and `controls.captureBinding()` waits for the next input for rebinding menus.

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
npm run build          # tsdown -> dist/: ESM (one file per module), CJS (index + three), .d.ts / .d.cts
npm test               # regression tests (run in Node)
npm test -- astar      # also draws the visual A* demo in the terminal
npm test -- astar 1234 # the demo with a given seed (each run logs the seed it used)
npm run test:browser   # WebGL tests in your browser: serves a test page and opens it (refresh to re-run)
npm run test:browser:headless   # same tests in headless Chrome/Chromium via playwright-core (installed Chrome, or set CHROMIUM_PATH)
npm run docs           # API reference (TypeDoc) -> docs/index.html; npm run docs:watch regenerates on change
```
