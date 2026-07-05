import { PerspectiveCamera, Group, Object3D } from 'three';
import { clamp, deg2rad } from '../math';

/** Constructor options for {@link ThreeJsCameraRig}. Pass an existing `camera`, or `fov`/`aspect`/`near`/`far` to build a new `PerspectiveCamera`. */
export interface ThreeJsCameraRigParams {
    camera?: PerspectiveCamera,
    fov?: number,
    aspect?: number,
    near?: number,
    far?: number,
}

/**
 * Orbit-style camera rig: a `Group` that yaws around its own Y axis, with a
 * nested `gimbal` `Group` that pitches (tilts) and holds the actual
 * `PerspectiveCamera`. Drive it with {@link orbit}/{@link dolly}, typically
 * from mouse move/wheel events (see
 * {@link ThreeJsBoilerPlate.enableCameraRigControls}).
 */
export class ThreeJsCameraRig extends Group {
    gimbal: Group;
    camera: PerspectiveCamera;
    /** Optional object to rotate around instead of the rig itself, when following a target. */
    target: Object3D | undefined;

    mouseSensitivity: number = 0.01;
    wheelSensitivity: number = 0.02;

    minCameraDistance: number = 2;
    maxCameraDistance: number = 100.0;

    minTiltAngle: number = deg2rad(-90);
    maxTiltAngle: number = deg2rad(0);
    clampTiltAngle: boolean = false;

    constructor(params?: ThreeJsCameraRigParams) {
        super();

        this.gimbal = new Group();
        this.add(this.gimbal);

        this.camera = params?.camera ?? new PerspectiveCamera(
            params?.fov ?? 75,
            params?.aspect ?? 2,
            params?.near ?? 0.1,
            params?.far ?? 1000.0,
        );

        this.gimbal.add(this.camera);
    }

    /** Yaws {@link target} (or the rig itself) and pitches the {@link gimbal}, scaled by {@link mouseSensitivity}. Pitch is clamped to `[minTiltAngle, maxTiltAngle]` when {@link clampTiltAngle} is true. */
    orbit(deltaX: number, deltaY: number) {
        (this.target || this).rotateY(-deltaX * this.mouseSensitivity);

        this.gimbal.rotation.x = this.clampTiltAngle
            ? clamp(
                this.gimbal.rotation.x + (-deltaY * this.mouseSensitivity),
                this.minTiltAngle,
                this.maxTiltAngle
            )
            : this.gimbal.rotation.x + (-deltaY * this.mouseSensitivity);
    }

    /** Moves the camera along its local Z axis (zoom in/out), scaled by {@link wheelSensitivity} and clamped to `[minCameraDistance, maxCameraDistance]`. */
    dolly(deltaY: number) {
        this.camera.position.z = clamp(
            this.camera.position.z + (deltaY * this.wheelSensitivity),
            this.minCameraDistance,
            this.maxCameraDistance
        );
    }
}
