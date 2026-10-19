import { Emitter } from "../emitter";
import { Vector } from "../vector";

/**
 * Whether a key or button is down (`state` 1) or up (0), and when that last changed.
 *
 * @category Input
 */
export interface InputState {
    /** 1 = down, 0 = up */
    state: number,
    /** `Event.timeStamp` of the last change, ms */
    timeStamp: number,
}

// PointerEvent.buttons bit for each PointerEvent.button
const BUTTON_BITS = [1, 4, 2, 8, 16];

/**
 * Event-based input for keyboard, mouse, pen and touch: subscribe with `on()` and query state
 * at any time; no frame loop needed. One shared instance, {@link Input.instance}.
 *
 * Events (listeners get the DOM event):
 * - keys, by lowercased `KeyboardEvent.code`: `key_down`, `key_up`, `key_repeat`, `key_pressed`
 *   (released within `inputThreshold` ms), and per key `keyw_down`, `keyw_up`, `keyw_pressed`, ...
 * - buttons (mouse buttons; the primary finger or pen is button 0): `button_down`, `button_up`,
 *   `button_clicked`, and per button `button0_down`, `button0_up`, `button0_clicked`, ...
 *   No click after a drag.
 * - pointer: `pointer_move`; `drag_start`, `drag`, `drag_end` (moved `dragThreshold` px with a
 *   button down); `mouse_wheel`; `contextmenu` (see `disableContextMenu()`)
 * - every finger: `touch_down`, `touch_move`, `touch_up`, `touch_cancel`
 * - `blur`: the window lost focus or the tab was hidden; every key and button is released
 *
 * ```ts
 * const input = Input.instance;
 * input.target = canvas;
 *
 * input.on('keyw_down', 'arrowup_down', () => move(0, -1));
 * input.on('button0_clicked', () => select(input.pointerPosition));
 * input.on('pointer_move', () => {
 *     if (input.isButtonDown(0)) pan(input.pointerDelta.x, input.pointerDelta.y);
 * });
 * ```
 *
 * @category Input
 */
export class Input extends Emitter {
    private static _instance?: Input;

    /** the shared instance, created on first use */
    static get instance(): Input {
        if (!Input._instance) {
            Input._instance = new Input();
        }

        return Input._instance;
    }

    private _state: Record<string, InputState> = {};
    private _windowListeners: [string, EventListener][] = [];
    private _targetListeners: [string, EventListener][] = [];
    private _target: EventTarget = window;
    private _contextMenuDisabled = false;

    private _dragStart?: Vector;
    private _dragging = false;

    /** pixels from the target's top-left */
    readonly pointerPosition = new Vector();
    /** -1..1 across the target, y up */
    readonly pointerPositionNdc = new Vector();
    /** pixels moved by the last pointer event (mouse, pen and touch alike) */
    readonly pointerDelta = new Vector();

    /** ms; a key or button released within this is also `_pressed` / `_clicked` */
    inputThreshold: number = 200;
    /** px; moving further than this with a button down starts a drag */
    dragThreshold: number = 5;

    /**
     * Where pointer, wheel and context-menu events are read and positions are measured, default
     * `window`; usually the canvas. Keys are always read from `window`.
     */
    get target(): EventTarget { return this._target; }

    /** moves the pointer, wheel and context-menu listeners to `target` */
    set target(target: EventTarget) {
        this._targetListeners.forEach(([type, listener]) => this._target.removeEventListener(type, listener));
        this._targetListeners = [];

        this._target = target;
        this._listenToTarget();
    }

    /** a drag is in progress */
    get isDragging(): boolean { return this._dragging; }

    private constructor() {
        super();

        this._listen(this._windowListeners, window, 'keydown', this._onKeyDown);
        this._listen(this._windowListeners, window, 'keyup', this._onKeyUp);
        this._listen(this._windowListeners, window, 'blur', this._onBlur);

        if (typeof document !== 'undefined') {
            this._listen(this._windowListeners, document, 'visibilitychange', () => {
                if (document.hidden) this._onBlur(new Event('blur') as FocusEvent);
            });
        }

        this._listenToTarget();
    }

    /** Stops the right-click menu on the target; `contextmenu` is still emitted. */
    disableContextMenu() {
        if (this._contextMenuDisabled) return;

        this._contextMenuDisabled = true;
        this._listen(this._targetListeners, this._target, 'contextmenu', this._onContextMenu);
    }

    /** Removes every DOM listener; the next {@link Input.instance} is a new one. */
    dispose() {
        this._windowListeners.forEach(([type, listener]) => {
            window.removeEventListener(type, listener);
            if (typeof document !== 'undefined') document.removeEventListener(type, listener);
        });
        this._targetListeners.forEach(([type, listener]) => this._target.removeEventListener(type, listener));
        this._windowListeners = [];
        this._targetListeners = [];

        Input._instance = undefined;
    }

    private _listenToTarget() {
        const listeners = this._targetListeners;

        this._listen(listeners, this._target, 'pointerdown', this._onPointerDown);
        this._listen(listeners, this._target, 'pointerup', this._onPointerUp);
        this._listen(listeners, this._target, 'pointercancel', this._onPointerUp);
        this._listen(listeners, this._target, 'pointermove', this._onPointerMove);
        this._listen(listeners, this._target, 'wheel', this._onWheel, { passive: false });

        if (this._contextMenuDisabled) {
            this._listen(listeners, this._target, 'contextmenu', this._onContextMenu);
        }

        // otherwise the browser scrolls / zooms the page instead of reporting touch drags
        const style = (this._target as HTMLElement).style;
        if (style) style.touchAction = 'none';
    }

    private _listen(listeners: [string, EventListener][], target: EventTarget, type: string, handler: (ev: any) => void, options?: AddEventListenerOptions) {
        const listener = handler.bind(this) as EventListener;

        target.addEventListener(type, listener, options);
        listeners.push([type, listener]);
    }

    private _down(id: string, group: string, name: string, ev: Event) {
        if (this._state[id]?.state) return;

        this._state[id] = { state: 1, timeStamp: ev.timeStamp };

        this.emit(`${group}_down`, ev);
        this.emit(`${name}_down`, ev);
    }

    private _up(id: string, group: string, name: string, quick: string, ev: Event) {
        const down = this._state[id];

        if (!down?.state) return;

        this._state[id] = { state: 0, timeStamp: ev.timeStamp };

        this.emit(`${group}_up`, ev);
        this.emit(`${name}_up`, ev);

        if (!this._dragging && ev.timeStamp - down.timeStamp <= this.inputThreshold) {
            this.emit(`${group}_${quick}`, ev);
            this.emit(`${name}_${quick}`, ev);
        }
    }

    private _anyButtonDown(): boolean {
        return BUTTON_BITS.some((_, button) => this.isButtonDown(button));
    }

    private _updatePointer(ev: PointerEvent) {
        const element = this._target as Element;
        const rect = element.getBoundingClientRect?.() ?? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };

        const x = ev.clientX - rect.left;
        const y = ev.clientY - rect.top;

        // mouse and pen report their own movement (also under pointer lock); touch doesn't
        if (ev.pointerType === 'touch') this.pointerDelta.set(x - this.pointerPosition.x, y - this.pointerPosition.y);
        else this.pointerDelta.set(ev.movementX ?? 0, ev.movementY ?? 0);

        this.pointerPosition.set(x, y);
        this.pointerPositionNdc.set((x / (rect.width || 1)) * 2 - 1, -(y / (rect.height || 1)) * 2 + 1);
    }

    private _onContextMenu(ev: MouseEvent) {
        ev.preventDefault();
        this.emit('contextmenu', ev);
    }

    private _onKeyDown(ev: KeyboardEvent) {
        if (ev.repeat) this.emit('key_repeat', ev);
        else this._down(ev.code, 'key', ev.code.toLowerCase(), ev);
    }

    private _onKeyUp(ev: KeyboardEvent) {
        this._up(ev.code, 'key', ev.code.toLowerCase(), 'pressed', ev);
    }

    // extra fingers / pens don't touch the button state; the primary one acts as button 0
    private _onPointerDown(ev: PointerEvent) {
        if (ev.pointerType === 'touch') this.emit('touch_down', ev);
        if (!ev.isPrimary) return;

        (this._target as Element).setPointerCapture?.(ev.pointerId); // keep receiving moves outside the target

        this._updatePointer(ev);
        this.pointerDelta.set(0, 0);

        if (!this._anyButtonDown()) {
            this._dragStart = this.pointerPosition.clone();
            this._dragging = false;
        }

        this._down(`button${ev.button}`, 'button', `button${ev.button}`, ev);
    }

    private _onPointerUp(ev: PointerEvent) {
        if (ev.pointerType === 'touch') this.emit(ev.type === 'pointercancel' ? 'touch_cancel' : 'touch_up', ev);
        if (!ev.isPrimary) return;

        this._updatePointer(ev);
        this._up(`button${ev.button}`, 'button', `button${ev.button}`, 'clicked', ev);

        if (!this._anyButtonDown()) this._endDrag(ev);
    }

    private _onPointerMove(ev: PointerEvent) {
        if (ev.pointerType === 'touch') this.emit('touch_move', ev);
        if (!ev.isPrimary) return;

        this._updatePointer(ev);

        // a button pressed or released while another is held arrives as a move with `button` set
        if (ev.pointerType === 'mouse' && ev.button >= 0) {
            const id = `button${ev.button}`;

            if (ev.buttons & BUTTON_BITS[ev.button]) this._down(id, 'button', id, ev);
            else this._up(id, 'button', id, 'clicked', ev);
        }

        if (this._dragStart && this._anyButtonDown()) {
            if (!this._dragging && this.pointerPosition.distanceTo(this._dragStart) > this.dragThreshold) {
                this._dragging = true;
                this.emit('drag_start', ev);
            }

            if (this._dragging) this.emit('drag', ev);
        }

        this.emit('pointer_move', ev);
    }

    private _endDrag(ev: Event) {
        if (this._dragging) this.emit('drag_end', ev);

        this._dragStart = undefined;
        this._dragging = false;
    }

    private _onWheel(ev: WheelEvent) {
        this.emit('mouse_wheel', ev);
    }

    // key-ups and button-ups that happen while the window is unfocused never arrive
    private _onBlur(ev: FocusEvent) {
        Object.values(this._state).forEach(s => s.state = 0);
        this._endDrag(ev);
        this.emit('blur', ev);
    }

    /** Whether a key (by `KeyboardEvent.code`, e.g. 'KeyW') is down. */
    isKeyDown(keyCode: string): boolean {
        return this._state[keyCode]?.state === 1;
    }

    /** 1 if the key is down, else 0. */
    getKeyState(keyCode: string): number {
        return this._state[keyCode]?.state ?? 0;
    }

    /** Whether a button (`PointerEvent.button`: 0 left / primary finger, 1 middle, 2 right, ...) is down. */
    isButtonDown(buttonNumber: number): boolean {
        return this._state[`button${buttonNumber}`]?.state === 1;
    }

    /** 1 if the button is down, else 0. */
    getButtonState(buttonNumber: number): number {
        return this._state[`button${buttonNumber}`]?.state ?? 0;
    }
}
