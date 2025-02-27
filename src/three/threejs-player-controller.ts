import { Group, PerspectiveCamera, Vector3 } from 'three';
import { ThreeJsCameraRig } from './threejs-camera-rig';

export class ThreeJsPlayerController extends Group {
    moveSpeed: number = 1.0;
    cameraRig: ThreeJsCameraRig;
    velocity: Vector3;

    constructor(camera: PerspectiveCamera) {
        super();

        this.velocity = new Vector3();
        this.cameraRig = new ThreeJsCameraRig(camera);
        this.add(this.cameraRig);
    }

    update(deltaTime: number) {
        if (this.velocity.length()) {
            this.translateOnAxis(this.velocity.normalize(), this.moveSpeed * deltaTime);
        }
    }
}
