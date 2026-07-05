import { Group, PerspectiveCamera, Vector3 } from 'three';
import { ThreeJsCameraRig } from './threejs-camera-rig';

/**
 * Movable player root: a `Group` carrying a {@link ThreeJsCameraRig} that
 * translates along {@link velocity} each {@link update}. Set `velocity`
 * (e.g. from input) to move the player; the rig's own orbit/dolly handles
 * looking around independently.
 */
export class ThreeJsPlayerController extends Group {
    moveSpeed: number = 1.0;
    cameraRig: ThreeJsCameraRig;
    velocity: Vector3;

    constructor(camera: PerspectiveCamera) {
        super();

        this.velocity = new Vector3();
        this.cameraRig = new ThreeJsCameraRig({ camera });
        this.add(this.cameraRig);
    }

    /** Translates the controller along the (normalized) {@link velocity} direction, scaled by {@link moveSpeed} and `deltaTime`. Call once per frame. */
    update(deltaTime: number) {
        if (this.velocity.length()) {
            this.translateOnAxis(this.velocity.normalize(), this.moveSpeed * deltaTime);
        }
    }
}
