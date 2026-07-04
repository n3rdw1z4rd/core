# Three.js Bootstrap

`import { ... } from '@n3rdw1z4rd/core/three';` (or the top-level barrel)

## ThreeJsBoilerPlate

The "just get a scene on screen" entry point: bundles a `Scene`, `WebGLRenderer`, `Clock`, `Input`, and a camera rig, plus resize handling and a couple of quick primitive-mesh factories.

```ts
interface SetupBasicSceneParams {
    ambientLight?: boolean;      // default true
    directionalLight?: boolean;  // default true
    gridHelper?: boolean;        // default true
    cameraDistance?: number;     // default 5
    enableControls?: boolean;    // default false - wires up enableCameraRigControls()
}

interface ThreeJsBoilerPlateParams {
    parentElement?: HTMLElement;
    renderer?: WebGLRendererParameters;
    camera?: { fov?: number, aspect?: number, near?: number, far?: number };
    seed?: number; // sets rng.seed at construction time
}

class ThreeJsBoilerPlate {
    clock: Clock;
    scene: Scene;
    input: Input;
    renderer: WebGLRenderer;
    cameraRig: ThreeJsCameraRig;
    orbitControls?: OrbitControls; // only set after enableOrbitControls()
    rng: Rng;

    readonly canvas: HTMLCanvasElement;
    readonly camera: PerspectiveCamera; // cameraRig.camera

    constructor(params?: ThreeJsBoilerPlateParams);

    enableCameraRigControls(): void;       // hand-rolled orbit/dolly via Input events - see note below
    enableOrbitControls(): Promise<void>;  // Three's own OrbitControls instead - see note below
    update(): void;                        // call once per frame - only does anything if enableOrbitControls() is active

    appendTo(htmlElement?: HTMLElement): void;
    resize(displayWidth?: number, displayHeight?: number): boolean;
    setupBasicScene(params?: SetupBasicSceneParams): void;
    pick(): Intersection | null; // raycasts from the current mouse position against scene.children

    static CreateCubeMesh(size?: number, color?: ColorRepresentation): Mesh;
    static CreatePlaneMesh(size?: number, segments?: number, color?: ColorRepresentation): Mesh;
}
```

```ts
import { ThreeJsBoilerPlate } from '@n3rdw1z4rd/core/three';

const app = new ThreeJsBoilerPlate({ parentElement: document.body });
app.setupBasicScene({ enableControls: true });
app.scene.add(ThreeJsBoilerPlate.CreateCubeMesh());

app.clock.run((dt) => {
    app.update();
    app.renderer.render(app.scene, app.camera);
});

window.addEventListener('resize', () => app.resize());
```

**`enableCameraRigControls()` and `enableOrbitControls()` are mutually exclusive - pick one.** The former drives `ThreeJsCameraRig.orbit()`/`dolly()` from `this.input`'s mouse events (no external dependency beyond Three's core). The latter swaps in Three's own `OrbitControls` addon and requires calling `app.update()` every frame to actually apply movement. `enableOrbitControls()` is `async` because `OrbitControls` ships as an ESM-only addon module - it's dynamically imported so this package (built as both CJS and ESM) doesn't have to statically import an ESM-only file.

## ThreeJsCameraRig

The hand-rolled orbit rig used by `enableCameraRigControls()` above. A `Group` containing a nested `gimbal` `Group` (for tilt) with the camera attached inside it.

```ts
interface ThreeJsCameraRigParams {
    camera?: PerspectiveCamera; // reuse an existing camera instead of constructing one
    fov?: number; aspect?: number; near?: number; far?: number;
}

class ThreeJsCameraRig extends Group {
    gimbal: Group;
    camera: PerspectiveCamera;
    target: Object3D | undefined; // if set, orbit() rotates this instead of the rig itself

    mouseSensitivity: number;  // default 0.01
    wheelSensitivity: number;  // default 0.02
    minCameraDistance: number; // default 2
    maxCameraDistance: number; // default 100
    minTiltAngle: number;      // default -90deg (in radians)
    maxTiltAngle: number;      // default 0deg
    clampTiltAngle: boolean;   // default false - tilt is unclamped unless you turn this on

    constructor(params?: ThreeJsCameraRigParams);
    orbit(deltaX: number, deltaY: number): void;
    dolly(deltaY: number): void;
}
```

## ThreeJsPlayerController

A simple first/third-person-style controller: a `Group` that holds a `ThreeJsCameraRig` and moves along a velocity vector each frame.

```ts
class ThreeJsPlayerController extends Group {
    moveSpeed: number; // default 1.0
    cameraRig: ThreeJsCameraRig;
    velocity: Vector3;

    constructor(camera: PerspectiveCamera);
    update(deltaTime: number): void; // translates along velocity.normalize() * moveSpeed * deltaTime, if velocity is non-zero
}
```

Set `velocity` directly (e.g. from `Input` key states) before calling `update()` each frame; there's no built-in input wiring here, unlike `ThreeJsBoilerPlate`.
