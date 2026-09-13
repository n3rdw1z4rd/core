import { PerspectiveCamera, Group, Object3D } from 'three';
import { clamp, radians } from '../math';

export interface CameraRigParams {
    fov?: number;
    aspect?: number;
    near?: number;
    far?: number;
}

const DEFAULT_CAMERA_ASPECT = 2;
const DEFAULT_CAMERA_DISTANCE = 5;
const DEFAULT_CAMERA_FAR = 1000;
const DEFAULT_CAMERA_FOV = 70;
const DEFAULT_CAMERA_MAX_DISTANCE = 50;
const DEFAULT_CAMERA_MIN_DISTANCE = 1.5;
const DEFAULT_CAMERA_NEAR = 0.1;
const DEFAULT_GIMBLE_CLAMP_ANGLE = false;
const DEFAULT_GIMBLE_MAX_ANGLE = 0;
const DEFAULT_GIMBLE_MIN_ANGLE = radians(-90);
const DEFAULT_MOUSE_SENSITIVITY = 0.01;
const DEFAULT_WHEEL_SENSITIVITY = 0.02;

export class CameraRig extends Group {
    gimbal: Group;
    camera: PerspectiveCamera;

    private _target?: Object3D;

    clampTiltAngle: boolean = DEFAULT_GIMBLE_CLAMP_ANGLE;
    maxDistance: number = DEFAULT_CAMERA_MAX_DISTANCE;
    maxTiltAngle: number = DEFAULT_GIMBLE_MAX_ANGLE;
    minDistance: number = DEFAULT_CAMERA_MIN_DISTANCE;
    minTiltAngle: number = DEFAULT_GIMBLE_MIN_ANGLE;
    mouseSensitivity: number = DEFAULT_MOUSE_SENSITIVITY;
    wheelSensitivity: number = DEFAULT_WHEEL_SENSITIVITY;


    constructor(params?: CameraRigParams) {
        super();

        this.gimbal = new Group();
        this.add(this.gimbal);

        this.camera = new PerspectiveCamera(
            params?.fov ?? DEFAULT_CAMERA_FOV,
            params?.aspect ?? DEFAULT_CAMERA_ASPECT,
            params?.near ?? DEFAULT_CAMERA_NEAR,
            params?.far ?? DEFAULT_CAMERA_FAR,
        );

        this.gimbal.add(this.camera);

        this.camera.position.z = DEFAULT_CAMERA_DISTANCE;

        this.gimbal.rotateX(radians(-45));
        this.rotateY(radians(45));
    }

    setTarget(target?: Object3D) {
        if (target) {
            this.rotation.set(0, 0, 0);
            this.position.set(0, 0, 0);

            target.add(this);
        }

        this._target = target;
    }

    orbit(deltaX: number, deltaY: number) {
        (this._target ?? this).rotateY(-deltaX * this.mouseSensitivity);

        this.gimbal.rotation.x = this.clampTiltAngle
            ? clamp(
                this.gimbal.rotation.x + (-deltaY * this.mouseSensitivity),
                this.minTiltAngle,
                this.maxTiltAngle
            )
            : this.gimbal.rotation.x + (-deltaY * this.mouseSensitivity);
    }

    dolly(deltaY: number) {
        this.camera.position.z = clamp(
            this.camera.position.z + (deltaY * this.wheelSensitivity),
            this.minDistance,
            this.maxDistance
        );
    }
}
