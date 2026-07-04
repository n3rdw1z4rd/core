import '../css/main.css';
import { AmbientLight, BoxGeometry, ColorRepresentation, DirectionalLight, GridHelper, Intersection, Mesh, MeshLambertMaterial, PerspectiveCamera, PlaneGeometry, Raycaster, Scene, Vector2, WebGLRenderer, WebGLRendererParameters } from 'three';
import type { OrbitControls } from 'three/examples/jsm/Addons.js' with { 'resolution-mode': 'import' };
import { Clock } from '../clock';
import { Input } from '../input';
import { KeyValue } from '../types';
import { rng } from '../rng';
import { ThreeJsCameraRig } from './threejs-camera-rig';

export interface SetupBasicSceneParams {
    ambientLight?: boolean,
    directionalLight?: boolean,
    gridHelper?: boolean,
    cameraDistance?: number,
    enableControls?: boolean,
}

export interface ThreeJsBoilerPlateParams {
    parentElement?: HTMLElement,
    renderer?: WebGLRendererParameters,
    camera?: {
        fov?: number,
        aspect?: number,
        near?: number,
        far?: number,
    },
    seed?: number,
}

export class ThreeJsBoilerPlate {
    public clock = new Clock();
    public scene = new Scene();
    public input = new Input();
    private raycaster = new Raycaster();

    public renderer: WebGLRenderer;
    public cameraRig: ThreeJsCameraRig;
    public orbitControls?: OrbitControls;

    public get canvas(): HTMLCanvasElement { return this.renderer.domElement; }
    public get camera(): PerspectiveCamera { return this.cameraRig.camera; }

    public rng = rng;

    constructor(params?: ThreeJsBoilerPlateParams) {
        rng.seed = (params?.seed ?? rng.seed);

        this.renderer = new WebGLRenderer(params?.renderer);
        this.cameraRig = new ThreeJsCameraRig(params?.camera);

        this.scene.add(this.cameraRig);

        if (params?.parentElement) {
            this.appendTo(params.parentElement);
        }
    }

    // Mutually exclusive with enableOrbitControls() - pick one. Gives you
    // manual orbit()/dolly() with tilt clamping and target-following, driven
    // by this.input's mouse events.
    public enableCameraRigControls() {
        this.orbitControls?.dispose();
        this.orbitControls = undefined;

        this.input
            .on('mouse_move', ({ deltaX, deltaY }: KeyValue) => {
                if (this.input.isMouseButtonDown(0)) {
                    this.cameraRig.orbit(deltaX, deltaY);
                }
            })
            .on('mouse_wheel', ({ deltaY }: KeyValue) => this.cameraRig.dolly(deltaY));
    }

    // Mutually exclusive with enableCameraRigControls() - pick one. Uses
    // Three's own OrbitControls instead of the hand-rolled rig math; call
    // update() once per frame in your render loop while this is active.
    // Async because OrbitControls only ships as an ESM-only addon module -
    // a dynamic import avoids forcing this whole package (built as both
    // CJS and ESM) to statically import an ESM-only file.
    public async enableOrbitControls() {
        const { OrbitControls } = await import('three/examples/jsm/Addons.js');

        this.orbitControls = new OrbitControls(this.camera, this.canvas);
        this.orbitControls.minDistance = 0.5;
        this.orbitControls.maxDistance = 100;
        this.orbitControls.update();
    }

    // Call once per frame if enableOrbitControls() is active - no-op otherwise.
    public update() {
        this.orbitControls?.update();
    }

    public appendTo(htmlElement?: HTMLElement) {
        if (this.canvas.parentElement) {
            this.canvas.parentElement.removeChild(this.canvas);
        }

        if (htmlElement) {
            htmlElement.appendChild(this.canvas);
            this.resize();
        }
    }

    public resize(displayWidth?: number, displayHeight?: number): boolean {
        const { width, height } = (
            this.canvas.parentElement?.getBoundingClientRect() ??
            this.canvas.getBoundingClientRect()
        );

        displayWidth = (0 | (displayWidth ?? width));
        displayHeight = (0 | (displayHeight ?? height));

        let resized: boolean = false;

        if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
            this.renderer.setSize(displayWidth, displayHeight);

            this.cameraRig.camera.aspect = displayWidth / displayHeight;
            this.cameraRig.camera.updateProjectionMatrix();

            resized = true;
        }

        return resized;
    }

    public setupBasicScene(params: SetupBasicSceneParams = {}) {
        this.camera.position.z = params.cameraDistance ?? 5;

        if (params.ambientLight !== false) this.scene.add(new AmbientLight());
        if (params.directionalLight !== false) this.scene.add(new DirectionalLight());
        if (params.gridHelper !== false) this.scene.add(new GridHelper(100, 100, 0xff0000));

        if (params.enableControls === true) {
            this.enableCameraRigControls();
        }
    }

    public pick(): Intersection | null {
        const pickX = (this.input.mousePosition[0] / this.renderer.domElement.width) * 2 - 1;
        const pickY = -(this.input.mousePosition[1] / this.renderer.domElement.height) * 2 + 1;

        this.raycaster.setFromCamera(new Vector2(pickX, pickY), this.cameraRig.camera);

        const intersected = this.raycaster.intersectObjects(this.scene.children);

        return intersected.length ? intersected[0] : null;
    }

    public static CreateCubeMesh(size: number = 1, color: ColorRepresentation = 0xff0000): Mesh {
        const cubeMesh = new Mesh(
            new BoxGeometry(size, size, size),
            new MeshLambertMaterial({ color }),
        );

        cubeMesh.name = 'CubeMesh';

        return cubeMesh;
    }

    public static CreatePlaneMesh(size: number = 10, segments: number = 10, color: ColorRepresentation = 0xff0000): Mesh {
        return new Mesh(
            new PlaneGeometry(size, size, segments, segments),
            new MeshLambertMaterial({ color, wireframe: true }),
        );
    }
}
