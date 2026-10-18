import { Group, type Object3D, PerspectiveCamera, Raycaster, Vector3 } from 'three';
import { clamp, lerp, radians, saturate } from '../math';

/**
 * Options for the {@link CameraRig} constructor.
 *
 * @category Camera
 */
export interface CameraRigParams {
    /** camera to use; default: a new PerspectiveCamera built from `fov`, `aspect`, `near`, `far` */
    camera?: PerspectiveCamera,
    /** degrees, vertical; default 70 (ignored when `camera` is given) */
    fov?: number,
    /** default 2 (ignored when `camera` is given) */
    aspect?: number,
    /** default 0.1 (ignored when `camera` is given) */
    near?: number,
    /** default 1000 (ignored when `camera` is given) */
    far?: number,
    /** object to follow; see {@link CameraRig.target} */
    target?: Object3D,
    /** starting zoom distance, default 5; clamped like {@link CameraRig.distance} */
    distance?: number,
}

/**
 * Pitch range for a {@link CameraRig}.
 *
 * @category Camera
 */
export interface PitchLimits {
    /** radians; negative looks down */
    min: number,
    /** radians; positive looks up */
    max: number,
}

const DEFAULT_DISTANCE = 5;

// exponential smoothing that behaves the same at any frame rate; damping <= 0 snaps
const damp = (current: number, target: number, damping: number, deltaTime: number): number =>
    damping > 0 ? lerp(current, target, 1 - Math.exp(-damping * deltaTime)) : target;

/**
 * Third-person camera that orbits a target and zooms seamlessly into first person.
 *
 * The orbit pivot sits at the target's eye height (`targetOffset`); the camera sits `distance`
 * behind it. Zooming below `firstPersonThreshold` goes to distance 0, which puts the camera at the
 * eyes: first person, with the same yaw and pitch.
 *
 * Add the rig to the scene (not to the target), feed it input with `orbit()` / `dolly()`, and call
 * `update(deltaTime)` once per frame.
 *
 * ```ts
 * const rig = new CameraRig({ target: player, distance: 6 });
 * scene.add(rig);
 *
 * addEventListener('mousemove', (e) => rig.orbit(e.movementX, e.movementY));
 * addEventListener('wheel', (e) => rig.dolly(e.deltaY));
 *
 * // each frame
 * rig.update(deltaTime);
 * renderer.render(scene, rig.camera);
 * ```
 *
 * @category Camera
 */
export class CameraRig extends Group {
    /** the camera to render with; a child of `gimbal` */
    readonly camera: PerspectiveCamera;
    /** pitch */
    readonly gimbal = new Group();

    /** followed by position, not parented */
    target?: Object3D;
    /** pivot (eye height) above the target's origin, world space */
    targetOffset = new Vector3(0, 1.6, 0);

    /** radians, around world up */
    yaw = 0;
    /** radians, negative looks down */
    pitch = 0;

    /** > 0 disables first person */
    minDistance = 0;
    /** furthest zoom distance */
    maxDistance = 20;
    /** zooming in below this goes all the way to first person */
    firstPersonThreshold = 0.5;

    /** pitch range in third person; default -80° to 30° */
    pitchLimits: PitchLimits = { min: radians(-80), max: radians(30) };
    /** pitch range in first person; the range blends between the two while zooming */
    firstPersonPitchLimits: PitchLimits = { min: radians(-89), max: radians(89) };

    /** sideways camera shift in third person (over-the-shoulder) */
    shoulderOffset = 0;
    /** the shift fades out as distance goes from this to 0 */
    shoulderFadeDistance = 2;

    /** set `target.visible = false` while in first person */
    hideTargetInFirstPerson = true;

    /** the camera pulls in rather than passing through these */
    collisionObjects: Object3D[] = [];
    /** distance kept between the camera and a surface */
    collisionPadding = 0.2;

    /** radians per pixel */
    orbitSensitivity = 0.005;
    /** per wheel delta unit (multiplicative zoom) */
    zoomSensitivity = 0.001;
    /** higher = snappier; 0 = instant */
    zoomDamping = 12;
    /** 0 = locked to the target */
    followDamping = 0;

    /** called from `update()` when the camera switches between first and third person */
    onModeChange?: (firstPerson: boolean) => void;

    private _targetDistance: number;   // where the zoom is heading
    private _distance: number;         // smoothed zoom
    private _cameraDistance: number;   // after collision
    private _recovering = false;       // easing back out after a collision released
    private _firstPerson = false;
    private _initialized = false;

    private readonly _raycaster = new Raycaster();
    private readonly _pivot = new Vector3();
    private readonly _desired = new Vector3();
    private readonly _direction = new Vector3();

    /** Zoom distance the rig is easing towards; 0 = first person. */
    get distance(): number { return this._targetDistance; }
    /**
     * Jumps to a zoom distance without easing, clamped to [`minDistance`, `maxDistance`]; below
     * `firstPersonThreshold` becomes 0 (first person) unless `minDistance > 0`.
     */
    set distance(value: number) {
        this._targetDistance = this._distance = this._cameraDistance = this._clampDistance(value);
    }

    /** Current distance of the camera from the pivot, after smoothing and collision. */
    get cameraDistance(): number { return this._cameraDistance; }

    /** whether the camera is currently closer than `firstPersonThreshold` (as of the last `update()`) */
    get isFirstPerson(): boolean { return this._firstPerson; }

    constructor(params: CameraRigParams = {}) {
        super();

        this.camera = params.camera ?? new PerspectiveCamera(
            params.fov ?? 70,
            params.aspect ?? 2,
            params.near ?? 0.1,
            params.far ?? 1000,
        );

        this.add(this.gimbal);
        this.gimbal.add(this.camera);

        this.target = params.target;

        const distance = this._clampDistance(params.distance ?? DEFAULT_DISTANCE);
        this._targetDistance = this._distance = this._cameraDistance = distance;
    }

    /** Rotate from pointer movement in pixels (e.g. movementX / movementY). */
    orbit(deltaX: number, deltaY: number): void {
        this.yaw -= deltaX * this.orbitSensitivity;
        this.pitch -= deltaY * this.orbitSensitivity;
        this._clampPitch();
    }

    /** Zoom from wheel movement (e.g. WheelEvent.deltaY); positive zooms out. */
    dolly(delta: number): void {
        if (this._targetDistance === 0 && delta > 0) {
            this._targetDistance = this.firstPersonThreshold; // multiplying 0 would never leave first person
        } else {
            this._targetDistance *= Math.exp(delta * this.zoomSensitivity);
        }

        this._targetDistance = this._clampDistance(this._targetDistance);
    }

    /**
     * Follows the target, eases zoom, applies yaw / pitch and collision, and positions the camera.
     * Call once per frame.
     *
     * @param deltaTime seconds since the last update
     */
    update(deltaTime: number): void {
        // pivot: the target's eye position, or the rig's own position when there is no target
        if (this.target) {
            this.target.getWorldPosition(this._pivot).add(this.targetOffset);

            if (this.parent) this.parent.worldToLocal(this._pivot);

            if (!this._initialized || this.followDamping <= 0) {
                this.position.copy(this._pivot);
            } else {
                const t = 1 - Math.exp(-this.followDamping * deltaTime);
                this.position.lerp(this._pivot, t);
            }
        }

        this._initialized = true;

        // minDistance / maxDistance / firstPersonThreshold may have changed since the last zoom
        this._targetDistance = this._clampDistance(this._targetDistance);
        this._distance = damp(this._distance, this._targetDistance, this.zoomDamping, deltaTime);
        if (Math.abs(this._distance - this._targetDistance) < 1e-4) this._distance = this._targetDistance;

        this._clampPitch();

        this.rotation.set(0, this.yaw, 0);
        this.gimbal.rotation.set(this.pitch, 0, 0);

        const shoulder = this.shoulderOffset * saturate(this._distance / this.shoulderFadeDistance);
        this._cameraDistance = this._collide(shoulder, this._distance, deltaTime);

        // keep the shoulder shift proportional when collision pulls the camera in
        const scale = this._distance > 0 ? this._cameraDistance / this._distance : 0;
        this.camera.position.set(shoulder * scale, 0, this._cameraDistance);

        this._setFirstPerson(this._cameraDistance < this.firstPersonThreshold);
    }

    private _collide(shoulder: number, distance: number, deltaTime: number): number {
        let allowed = distance;

        if (this.collisionObjects.length > 0 && distance > 0) {
            this.updateMatrixWorld(true);

            const pivot = this.gimbal.getWorldPosition(this._pivot);
            const desired = this.gimbal.localToWorld(this._desired.set(shoulder, 0, distance));
            const length = this._direction.subVectors(desired, pivot).length();

            this._raycaster.set(pivot, this._direction.normalize());
            this._raycaster.far = length;

            const hit = this._raycaster.intersectObjects(this.collisionObjects, true)[0];

            if (hit) {
                allowed = Math.max(0, (hit.distance - this.collisionPadding) / length * distance);
            }
        }

        // pull in instantly (never show the inside of a wall), ease back out once clear
        if (allowed < distance) {
            this._recovering = true;
            return allowed < this._cameraDistance ? allowed : damp(this._cameraDistance, allowed, this.zoomDamping, deltaTime);
        }

        if (this._recovering) {
            const eased = damp(this._cameraDistance, distance, this.zoomDamping, deltaTime);

            if (Math.abs(eased - distance) > 1e-3) return eased;

            this._recovering = false;
        }

        return distance;
    }

    private _clampDistance(distance: number): number {
        distance = clamp(distance, this.minDistance, this.maxDistance);

        return (this.minDistance <= 0 && distance < this.firstPersonThreshold) ? 0 : distance;
    }

    // limits blend from first-person to third-person over the first `firstPersonThreshold` of zoom
    private _clampPitch(): void {
        const t = saturate(this._distance / Math.max(this.firstPersonThreshold, 1e-6));

        this.pitch = clamp(
            this.pitch,
            lerp(this.firstPersonPitchLimits.min, this.pitchLimits.min, t),
            lerp(this.firstPersonPitchLimits.max, this.pitchLimits.max, t),
        );
    }

    private _setFirstPerson(firstPerson: boolean): void {
        if (firstPerson === this._firstPerson) return;

        this._firstPerson = firstPerson;

        if (this.hideTargetInFirstPerson && this.target) {
            this.target.visible = !firstPerson;
        }

        this.onModeChange?.(firstPerson);
    }
}
