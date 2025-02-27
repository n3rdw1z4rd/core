import { PerspectiveCamera, Group, Object3D } from 'three';
import { clamp, deg2rad } from '../math';

export interface ThreeJsCameraRigParams {
    fov?: number,
    aspect?: number,
    near?: number,
    far?: number,
}

export class ThreeJsCameraRig extends Group {
    gimbal: Group;
    camera: PerspectiveCamera;
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

        this.camera = new PerspectiveCamera(
            params?.fov ?? 75,
            params?.aspect ?? 2,
            params?.near ?? 0.1,
            params?.far ?? 1000.0,
        );

        this.gimbal.add(this.camera);
    }

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

    dolly(deltaY: number) {
        this.camera.position.z = clamp(
            this.camera.position.z + (deltaY * this.wheelSensitivity),
            this.minCameraDistance,
            this.maxCameraDistance
        );
    }
}
