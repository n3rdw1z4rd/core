import type { Gesture } from './bindings';

/**
 * A finger currently on the screen, as reported by {@link GestureRecognizer.touches}.
 *
 * @property y current position, pixels
 * @property startY where the finger went down, pixels
 * @category Input
 */
export interface TouchPoint {
    /** pointer id, from `PointerEvent.pointerId` */
    id: number,
    /** current position, pixels relative to the input target */
    x: number, y: number,
    /** where the finger went down, pixels */
    startX: number, startY: number,
    /** when the finger went down, ms */
    startTime: number,
}

/**
 * Tuning values for {@link GestureRecognizer}.
 *
 * @category Input
 */
export interface GestureThresholds {
    /** ms, default 250 */
    tapMaxDuration: number,
    /** px; also how far a long press may drift. Default 10 */
    tapMaxMovement: number,
    /** ms between the two taps, default 300 */
    doubleTapMaxDelay: number,
    /** px between the two taps, default 30 */
    doubleTapMaxDistance: number,
    /** ms, default 500 */
    longPressDuration: number,
    /** px, default 50 */
    swipeMinDistance: number,
    /** ms, default 500 */
    swipeMaxDuration: number,
    /** relative scale change per frame that counts as pinching (0.005 = 0.5%, the default) */
    pinchMinChange: number,
}

/**
 * What {@link GestureRecognizer.update} recognized since the previous update.
 *
 * @category Input
 */
export interface GestureFrame {
    /** recognized since the last update */
    gestures: Gesture[],
    /** two-finger scale change this frame (1 = none, > 1 = fingers apart) */
    pinch: number,
    /** two-finger movement this frame, px */
    pan: { x: number, y: number },
    /** two-finger rotation this frame, radians (clockwise on screen) */
    rotate: number,
}

interface Tracked extends TouchPoint {
    maxMovement: number,
    /** another finger was down at some point: not a tap / swipe / long press */
    multi: boolean,
    longPressed: boolean,
}

const DEFAULT_THRESHOLDS: GestureThresholds = {
    tapMaxDuration: 250,
    tapMaxMovement: 10,
    doubleTapMaxDelay: 300,
    doubleTapMaxDistance: 30,
    longPressDuration: 500,
    swipeMinDistance: 50,
    swipeMaxDuration: 500,
    pinchMinChange: 0.005,
};

/**
 * Turns touch points into gestures: tap, double tap, long press, swipes (one finger) and
 * pinch / pan / rotate (two fingers). Feed it with down / move / up, call update() once per frame.
 * Times are in ms and positions in pixels, from any consistent clock and origin. {@link Input} drives
 * one for you; use this class directly only for custom touch handling.
 *
 * Tap, double tap and swipe are reported when the finger lifts, long press while it is still held;
 * a finger that was ever down together with another one never produces one-finger gestures.
 *
 * ```ts
 * const recognizer = new GestureRecognizer({ longPressDuration: 400 });
 * el.addEventListener('pointerdown', e => recognizer.down(e.pointerId, e.offsetX, e.offsetY, performance.now()));
 * // ... move / up / cancel likewise
 *
 * const { gestures, pinch } = recognizer.update(performance.now());
 * ```
 *
 * @category Input
 */
export class GestureRecognizer {
    /** current thresholds; may be changed at any time */
    readonly thresholds: GestureThresholds = { ...DEFAULT_THRESHOLDS };

    private readonly _touches = new Map<number, Tracked>();
    private _pending: Gesture[] = [];
    private _lastTap?: { x: number, y: number, time: number };

    // two-finger baseline from the previous update
    private _pair?: { a: number, b: number, distance: number, angle: number, cx: number, cy: number };

    /** Copies of the fingers currently down. */
    get touches(): TouchPoint[] {
        return [...this._touches.values()].map(({ id, x, y, startX, startY, startTime }) => ({ id, x, y, startX, startY, startTime }));
    }

    /** @param thresholds overrides for the default thresholds */
    constructor(thresholds: Partial<GestureThresholds> = {}) {
        Object.assign(this.thresholds, thresholds);
    }

    /** A finger touched down. */
    down(id: number, x: number, y: number, time: number): void {
        const multi = this._touches.size > 0;

        for (const touch of this._touches.values()) touch.multi = true;

        this._touches.set(id, { id, x, y, startX: x, startY: y, startTime: time, maxMovement: 0, multi, longPressed: false });
    }

    /** A finger moved; unknown ids are ignored. */
    move(id: number, x: number, y: number): void {
        const touch = this._touches.get(id);

        if (!touch) return;

        touch.x = x;
        touch.y = y;
        touch.maxMovement = Math.max(touch.maxMovement, Math.hypot(x - touch.startX, y - touch.startY));
    }

    /** A finger lifted; may queue a tap, double tap or swipe for the next update. */
    up(id: number, x: number, y: number, time: number): void {
        const touch = this._touches.get(id);

        if (!touch) return;

        this.move(id, x, y);
        this._touches.delete(id);

        if (touch.multi || touch.longPressed) return;

        const t = this.thresholds;
        const duration = time - touch.startTime;
        const dx = x - touch.startX;
        const dy = y - touch.startY;
        const distance = Math.hypot(dx, dy);

        if (duration <= t.tapMaxDuration && touch.maxMovement <= t.tapMaxMovement) {
            this._pending.push('tap');

            const last = this._lastTap;

            if (last && time - last.time <= t.doubleTapMaxDelay && Math.hypot(x - last.x, y - last.y) <= t.doubleTapMaxDistance) {
                this._pending.push('doubleTap');
                this._lastTap = undefined; // a third tap starts a new pair
            } else {
                this._lastTap = { x, y, time };
            }
        } else if (distance >= t.swipeMinDistance && duration <= t.swipeMaxDuration) {
            this._pending.push(Math.abs(dx) >= Math.abs(dy)
                ? (dx > 0 ? 'swipeRight' : 'swipeLeft')
                : (dy > 0 ? 'swipeDown' : 'swipeUp'));
        }
    }

    /** Forgets a finger without recognizing anything (e.g. on `pointercancel`). */
    cancel(id: number): void {
        this._touches.delete(id);
    }

    /** Forgets all fingers, gestures not yet reported, and the first tap of a pending double tap (e.g. on blur). */
    clear(): void {
        this._touches.clear();
        this._pair = undefined;
        this._pending = [];
        this._lastTap = undefined;
    }

    /** Returns what happened since the last update. `time` is the current time in ms. */
    update(time: number): GestureFrame {
        const frame: GestureFrame = { gestures: [], pinch: 1, pan: { x: 0, y: 0 }, rotate: 0 };

        // long press fires once, while still held
        for (const touch of this._touches.values()) {
            if (!touch.multi && !touch.longPressed && touch.maxMovement <= this.thresholds.tapMaxMovement &&
                time - touch.startTime >= this.thresholds.longPressDuration) {
                touch.longPressed = true;
                this._pending.push('longPress');
            }
        }

        // two fingers: compare with the previous frame (a new pair only sets the baseline)
        const [a, b] = [...this._touches.values()];

        if (a && b) {
            const distance = Math.hypot(b.x - a.x, b.y - a.y);
            const angle = Math.atan2(b.y - a.y, b.x - a.x);
            const cx = (a.x + b.x) / 2;
            const cy = (a.y + b.y) / 2;
            const pair = this._pair;

            if (pair && pair.a === a.id && pair.b === b.id) {
                frame.pinch = pair.distance > 0 ? distance / pair.distance : 1;
                frame.pan = { x: cx - pair.cx, y: cy - pair.cy };
                frame.rotate = Math.atan2(Math.sin(angle - pair.angle), Math.cos(angle - pair.angle));

                if (Math.abs(frame.pinch - 1) >= this.thresholds.pinchMinChange) {
                    this._pending.push(frame.pinch > 1 ? 'pinchOut' : 'pinchIn');
                }
            }

            this._pair = { a: a.id, b: b.id, distance, angle, cx, cy };
        } else {
            this._pair = undefined;
        }

        frame.gestures = this._pending;
        this._pending = [];

        return frame;
    }
}
