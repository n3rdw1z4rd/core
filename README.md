# @n3rdw1z4rd/core

A personal, browser-facing TypeScript toolkit consolidated out of several game/graphics side projects: math helpers and a deterministic, seedable RNG, event helpers, an event-based input system with action maps, two ECS flavors, procedural generation (pathfinding, dungeon layout), a "particle life" simulation in 2D and 3D, raw WebGL helpers, a node graph format and evaluator (`core/graph`), and a set of Three.js helpers (`core/three`: a scene `World` with component schemas, editor camera and picking, camera rigs, voxel meshing, texture atlases, procedural meshes).

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

The data and logic modules load and run anywhere, including Node (the tests run there): math, `Random`/`Rng`, `Vector`, `Rectangle`, `Map2D`/`Map3D`/`Tilemap`, `findPath` (A*), the dungeon generator, `ECS`, the event helpers (`Emitter`, `Observable`, `Signal`, `EventQueue`, `Disposable`), `Color` and color palettes, the spatial partitions, the particle simulations, and all of `@n3rdw1z4rd/core/graph` (in a page, a worker or Node).

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

## Three.js helpers (`@n3rdw1z4rd/core/three`)

A scene `World` for editors and games: entities are three.js `Object3D`s (tracked by their `uuid`, so ids stay stable), components are declared with schemas, and the whole scene saves and loads as JSON.

```ts
import { World, component, field, defineComponent } from "@n3rdw1z4rd/core/three";

@component("RigidBody")
class RigidBody {
    @field({ type: "enum", options: ["dynamic", "fixed"] }) kind = "dynamic";
    @field({ min: 0, step: 0.1 }) mass = 1;
}

// or as plain data (no decorators: works in workers and user scripts)
const Health = defineComponent("Health", { value: { type: "number", default: 100, min: 0 } });

const world = new World();
const ball = world.create("ball");                 // an Object3D; parent it to build a hierarchy
world.addComponent(ball, RigidBody, { mass: 2 });
world.query(RigidBody);                            // entities with a RigidBody
const saved = world.serialize();                   // JSON-safe; world.load(saved) restores it
```

Schemas are what let an editor work with components it has never seen: an inspector, a serializer or graph nodes can be generated from them. Class components use standard (TC39) decorators; until browsers run them natively, the `decorators()` Vite plugin from `@n3rdw1z4rd/core/vite` lowers them.

For editors: `EditorCamera` (orthographic or perspective; pan, zoom-at-cursor, orbit, fit, with `zoom` in screen px per world unit), `AdaptiveGrid` (a grid that keeps its spacing readable at any zoom), `pickEntity(world, camera, x, y)` (the entity under a screen point) and `Renderer` (a `WebGLRenderer` that uses the device pixel ratio and can size itself to its parent). Also: `CameraRig`, voxel meshing, texture atlases, `AsteroidMesh`, `CubeSphereGeometry`, a starfield and a 3D particle system.

## Node graphs (`@n3rdw1z4rd/core/graph`)

A graph document format, typed pins, node types (built-in or written as scripts) and a lazy, memoized evaluator. It has no DOM, so it runs in a page, a worker or Node.

```ts
import { createGraph, createNodeRegistry, addNode, connect, GraphEvaluator } from "@n3rdw1z4rd/core/graph";

const nodes = createNodeRegistry();               // the built-ins: values, math, lists, ...
const graph = createGraph();                      // { format: "n3rdw1z4rd.graph", nodes, links, ... }
const grid = addNode(graph, nodes.get("list/grid2d")!, [0, 0], { cols: 3, rows: 2 });
const count = addNode(graph, nodes.get("list/count")!, [240, 0]);
connect(graph, nodes, { node: grid.id, port: "points" }, { node: count.id, port: "list" });

const { results } = await new GraphEvaluator(nodes).evaluate(graph);
results.get(count.id)!.outputs.count;             // 6
```

- **Pins are typed** (`number`, `vec2`, `color`, `string`, `boolean`, `any`, your own via `portTypes.define()`), and `T[]` is a list. A list wired into a single-value input **broadcasts**: the node runs once per item (several lists pair up; the longest wins). A `multi` input takes any number of wires.
- **Evaluation is lazy and local**: only what the output nodes need is evaluated, results are memoized between evaluations, and a node that throws gets an error without stopping the rest. A multi input leaves out a source that failed; downstream nodes are marked `skipped`. Nodes can be `disabled`, and `animate` nodes re-run every frame (`evaluate(graph, { frame })`).
- **Nodes can be scripts.** A node type is an ES module with its interface and a `run()`; `compileNodeScript(type, source)` turns it into a node type, and every built-in carries an equivalent `source`, so an editor can show any node's code and let you fork it:

  ```js
  export const title = 'Double';
  export const inputs = { value: { type: 'number', default: 1 } };
  export const outputs = { value: 'number' };
  export function run({ value }, params, ctx) { return { value: value * 2 }; }
  ```

  A module that exports hooks instead of `run` (any of `BEHAVIOR_HOOKS`: `setup`, `step`, `enter`, `exit`) is a **behaviour** node: it evaluates to a `BehaviorValue` (its params and source) for a host to run, e.g. on a physics body.
- **Subgraphs**: `collapseToSubgraph(graph, nodes, ids, title)` turns a selection into a reusable node type (the wires crossing the selection become its pins); `expandSubgraph()` undoes it, and `registerSubgraphs()` restores the types from a saved document.
- **Documents** are plain JSON (`normalizeGraph()` checks and fills in one you've loaded): nodes, links, groups, subgraph definitions and embedded scripts.

[apparatus](https://github.com/n3rdw1z4rd/apparatus) is built on it: a node graph editor where the graph is a 2D physics scene.

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
