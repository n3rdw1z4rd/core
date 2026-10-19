import { Observable } from '../observable';
import { type Action, ActionMap } from './action-map';
import { type GestureFrame, GestureRecognizer, type TouchPoint } from './gestures';
import { Input } from './input';
import { type Binding, GAMEPAD_AXES, GAMEPAD_BUTTONS, type MouseButton, XR_AXES, XR_BUTTONS, type XRHand, controlId } from './bindings';

/**
 * 0 = keyboard, mouse, pen, touch and VR; 1, 2, ... = gamepads.
 *
 * @category Input
 */
export type InputDevice = number;

/**
 * The kind of device the player last used, see {@link InputActionMap.lastDevice}.
 *
 * @category Input
 */
export type InputDeviceType = 'keyboard' | 'mouse' | 'pen' | 'touch' | 'gamepad' | 'xr';

/**
 * When an {@link InputActionMap.onAction} callback fires: as the action becomes pressed, or released.
 *
 * @category Input
 */
export type ActionPhase = 'pressed' | 'released';

/**
 * Passed to {@link InputActionMap.onAction} callbacks.
 *
 * @category Input
 */
export interface ActionEvent {
    /** the action's name */
    action: string,
    /** an auto-repeat of a held action (see {@link ActionRepeat}), not a new press */
    repeat: boolean,
}

/**
 * Options for the {@link InputActionMap} constructor.
 *
 * @category Input
 */
export interface InputActionMapOptions {
    /** where events come from, default {@link Input.instance}; set `input.target` to the canvas */
    input?: Input,
    /** add the ui_* actions. Default true. */
    defaults?: boolean,
    /** stop bound keys / the wheel from scrolling the page. Default true. */
    preventDefault?: boolean,
    /** no right-click menu on the target. Default true. */
    preventContextMenu?: boolean,
}

/**
 * Restricts an action query to one {@link InputDevice}; without it, any device counts.
 *
 * @category Input
 */
export interface DeviceQuery {
    /** only this device; default: any */
    device?: InputDevice,
}

/**
 * A connected gamepad, see {@link InputActionMap.gamepads}.
 *
 * @category Input
 */
export interface GamepadInfo {
    /** gamepad.index + 1 */
    device: InputDevice,
    /** the browser's description of the controller */
    id: string,
    /** uses the standard mapping (button names are reliable); others map by index */
    standard: boolean,
}

/**
 * The parts of a WebXR XRSession that InputActionMap reads (structural, so no WebXR typings are required).
 *
 * @category Input
 */
export interface XRSessionLike extends EventTarget {
    /** the session's controllers */
    readonly inputSources: Iterable<{
        /** `'left'` or `'right'`; other values are ignored */
        readonly handedness: string,
        /** buttons in {@link XR_BUTTONS} order (value 0..1) and axes in {@link XR_AXES} order (-1..1) */
        readonly gamepad?: {
            /** in {@link XR_BUTTONS} order */
            readonly buttons: readonly {
                /** held down */
                pressed: boolean,
                /** 0..1 (analog for triggers and squeeze) */
                value: number,
            }[],
            /** in {@link XR_AXES} order, -1..1 */
            readonly axes: readonly number[],
        } | null,
    }>,
}

/**
 * Mouse or pen state, see {@link InputActionMap.pointer}. Positions update on pointer events; deltas and
 * wheel totals on each {@link InputActionMap.update}.
 *
 * @property y pixels, relative to the target's top-left, y down
 * @property ndcY -1..1, y up
 * @property deltaY movement during the last frame, pixels
 * @property wheelY wheel movement during the last frame, in pixels (positive = down)
 * @property tiltY pen: degrees
 *
 * @category Input
 */
export interface PointerState {
    /** the kind of pointer that last moved or pressed */
    type: 'mouse' | 'pen',
    /** pixels, relative to the target's top-left */
    x: number, y: number,
    /** -1..1, y up (for raycasting) */
    ndcX: number, ndcY: number,
    /** movement during the last frame, pixels (works under pointer lock) */
    deltaX: number, deltaY: number,
    /** wheel movement during the last frame, in pixels */
    wheelX: number, wheelY: number,
    /** pen: 0..1 */
    pressure: number,
    /** pen: degrees */
    tiltX: number, tiltY: number,
}

/**
 * Options for {@link InputActionMap.captureBinding}.
 *
 * @category Input
 */
export interface CaptureOptions {
    /** KeyboardEvent.code that cancels (resolves null); `null` for none. Default 'Escape'. */
    cancelKey?: string | null,
    /** only accept these kinds of input; others are ignored and still reach actions */
    types?: Binding['type'][],
}

interface ControlState {
    /** 0..1 */
    value: number,
    /** went down since the last update (so a press + release between frames still counts) */
    pressed: boolean,
    /** used to answer captureBinding(); ignored until released */
    suppressed: boolean,
}

interface ActionState {
    raw: number,
    strength: number,
    pressed: boolean,
    wasPressed: boolean,
    /** auto-repeated in the last update */
    repeated: boolean,
    /** ms; when the next auto-repeat is due */
    nextRepeat: number,
}

const ANY = -1;

const now = (): number => performance.now();

// indexed by PointerEvent.button
const MOUSE_BUTTONS: readonly MouseButton[] = ['left', 'middle', 'right', 'back', 'forward'];

const isEditable = (target: EventTarget | null): boolean => {
    const element = target as HTMLElement | null;
    const tag = element?.tagName;

    return !!element && (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || element.isContentEditable === true);
};

/**
 * Game input with a Godot-style action map, built on {@link Input}'s events: bind keys, buttons,
 * sticks, gestures and VR controls to named actions, then query actions instead of devices once
 * per frame. Gamepads and VR controllers are polled by `update()`.
 *
 *     Input.instance.target = canvas;
 *
 *     const controls = new InputActionMap();
 *     controls.actions.add('jump', [key('Space'), pad('A')]);
 *
 *     // every frame, before game logic:
 *     controls.update();
 *     if (controls.isActionJustPressed('jump')) player.jump();
 *
 * Call `dispose()` to stop listening.
 *
 * @category Input
 */
export class InputActionMap {
    /** the actions to query; holds the `ui_*` defaults unless {@link InputActionMapOptions.defaults} is false */
    readonly actions = new ActionMap();

    /** Thresholds for taps, swipes etc. can be tuned via `gestureRecognizer.thresholds`. */
    readonly gestureRecognizer = new GestureRecognizer();

    /**
     * Touch gestures from the last frame: `events` (each recognized gesture and where it happened,
     * e.g. the tap that triggered an action) and the two-finger values (pinch 1 / pan 0 / rotate 0
     * when not gesturing).
     */
    readonly gestures: Omit<GestureFrame, 'gestures'> = { events: [], pinch: 1, pan: { x: 0, y: 0 }, rotate: 0 };

    // TODO: on-screen virtual joystick / buttons for touch, feeding padAxis-style values into the action map

    /** the {@link Input} events are read from */
    readonly input: Input;

    /** Fingers currently on the target. */
    get touches(): TouchPoint[] { return this.gestureRecognizer.touches; }

    /** the mouse or pen; not updated by touch */
    readonly pointer: PointerState = {
        type: 'mouse', x: 0, y: 0, ndcX: 0, ndcY: 0, deltaX: 0, deltaY: 0, wheelX: 0, wheelY: 0, pressure: 0, tiltX: 0, tiltY: 0,
    };

    /** notified when {@link InputActionMap.lastDevice} changes, e.g. to switch on-screen button prompts */
    readonly onDeviceChange = new Observable<InputDeviceType>();
    /** notified from update() when a gamepad is first seen */
    readonly onGamepadConnected = new Observable<GamepadInfo>();
    /** notified from update() when a gamepad goes away; its held controls are released */
    readonly onGamepadDisconnected = new Observable<GamepadInfo>();

    private readonly _gamepads = new Map<InputDevice, Gamepad>();

    /** Connected gamepads, as found by the last update(). */
    get gamepads(): GamepadInfo[] {
        return [...this._gamepads].map(([device, gamepad]) => ({ device, id: gamepad.id, standard: gamepad.mapping === 'standard' }));
    }

    private _lastDevice: InputDeviceType = 'keyboard';
    private _keyLabels?: ReadonlyMap<string, string>;

    private readonly _options: Required<Omit<InputActionMapOptions, 'input'>>;
    private readonly _listeners: [string, (...args: any[]) => void][] = [];

    // device -> control id -> state
    private readonly _controls = new Map<InputDevice, Map<string, ControlState>>([[0, new Map()]]);
    // action -> device (or ANY) -> state
    private readonly _actionStates = new Map<string, Map<InputDevice, ActionState>>();
    private readonly _actionListeners: { action: string, phase: ActionPhase, device: InputDevice, callback: (event: ActionEvent) => void }[] = [];
    private readonly _warned = new Set<string>();

    private readonly _pending = { deltaX: 0, deltaY: 0, wheelX: 0, wheelY: 0 };

    private _capture?: { options: CaptureOptions, resolve: (binding: Binding | null) => void };

    /** The kind of device that produced the most recent input (initially `'keyboard'`). */
    get lastDevice(): InputDeviceType { return this._lastDevice; }

    /** Whether the pointer is locked to the target, see {@link InputActionMap.lockPointer}. */
    get isPointerLocked(): boolean {
        return typeof document !== 'undefined' && document.pointerLockElement === this.input.target;
    }

    constructor(options: InputActionMapOptions = {}) {
        this.input = options.input ?? Input.instance;
        this._options = {
            defaults: options.defaults ?? true,
            preventDefault: options.preventDefault ?? true,
            preventContextMenu: options.preventContextMenu ?? true,
        };

        if (this._options.defaults) this.actions.addDefaults();
        if (this._options.preventContextMenu) this.input.disableContextMenu();

        this._listen('key_down', (e: KeyboardEvent) => this._onKeyDown(e));
        this._listen('key_repeat', (e: KeyboardEvent) => this._onKeyDown(e));
        this._listen('key_up', (e: KeyboardEvent) => this._onKeyUp(e));
        this._listen('button_down', (e: PointerEvent) => this._onButton(e, 1));
        this._listen('button_up', (e: PointerEvent) => this._onButton(e, 0));
        this._listen('pointer_move', (e: PointerEvent) => this._onPointerMove(e));
        this._listen('touch_down', (e: PointerEvent) => this._onTouchDown(e));
        this._listen('touch_move', (e: PointerEvent) => this._onTouchMove(e));
        this._listen('touch_up', (e: PointerEvent) => this._onTouchUp(e));
        this._listen('touch_cancel', (e: PointerEvent) => this.gestureRecognizer.cancel(e.pointerId));
        this._listen('mouse_wheel', (e: WheelEvent) => this._onWheel(e));
        this._listen('blur', () => this.releaseAll(0));
    }

    /**
     * Call once per frame, before reading input: polls devices and advances "just pressed" /
     * "just released" by one frame. Action callbacks fire from here.
     *
     * @param time current time in ms (e.g. the `requestAnimationFrame` timestamp), used for
     * gesture timing and auto-repeat; default `performance.now()`
     */
    update(time: number = now()): void {
        // pointer movement and wheel accumulated since the last frame
        this.pointer.deltaX = this._pending.deltaX;
        this.pointer.deltaY = this._pending.deltaY;
        this.pointer.wheelX = this._pending.wheelX;
        this.pointer.wheelY = this._pending.wheelY;
        this._pending.deltaX = this._pending.deltaY = this._pending.wheelX = this._pending.wheelY = 0;

        this._pollGamepads();
        this._pollXR();
        this._updateGestures(time);

        const devices = [...this._controls.keys()];
        const fired: { action: string, phase: ActionPhase, device: InputDevice, repeat: boolean }[] = [];

        for (const name of this.actions.names) {
            const action = this.actions.get(name)!;

            let states = this._actionStates.get(name);
            if (!states) this._actionStates.set(name, states = new Map());

            let anyRaw = 0;

            for (const device of devices) {
                let raw = 0;

                for (const binding of action.bindings) {
                    raw = Math.max(raw, this._bindingValue(binding, device));
                }

                anyRaw = Math.max(anyRaw, raw);

                const phase = this._advance(states, device, raw, action, time);
                if (phase) fired.push({ action: name, phase, device, repeat: states.get(device)!.repeated });
            }

            const phase = this._advance(states, ANY, anyRaw, action, time);
            if (phase) fired.push({ action: name, phase, device: ANY, repeat: states.get(ANY)!.repeated });
        }

        // presses are consumed once actions have seen them
        for (const controls of this._controls.values()) {
            for (const state of controls.values()) state.pressed = false;
        }

        for (const { action, phase, device, repeat } of fired) {
            for (const listener of [...this._actionListeners]) {
                if (listener.action === action && listener.phase === phase && listener.device === device) {
                    listener.callback({ action, repeat });
                }
            }
        }
    }

    // ---- actions ----

    /** Whether the action is held past its deadzone. Unknown actions return false (and warn once). */
    isActionPressed(action: string, query?: DeviceQuery): boolean {
        return this._state(action, query)?.pressed ?? false;
    }

    /**
     * Whether the action became pressed in the last update(), or auto-repeated while held if the
     * action has {@link Action.repeat} (e.g. to keep walking while a direction is held).
     */
    isActionJustPressed(action: string, query?: DeviceQuery): boolean {
        const state = this._state(action, query);
        return !!state && state.pressed && (!state.wasPressed || state.repeated);
    }

    /** Whether the last update()'s press of the action was an auto-repeat rather than a new press. */
    isActionRepeated(action: string, query?: DeviceQuery): boolean {
        return this._state(action, query)?.repeated ?? false;
    }

    /** Whether the action was released in the last update(). */
    isActionJustReleased(action: string, query?: DeviceQuery): boolean {
        const state = this._state(action, query);
        return !!state && !state.pressed && state.wasPressed;
    }

    /** 0..1, rescaled past the action's deadzone (analog triggers and sticks give values in between). */
    getActionStrength(action: string, query?: DeviceQuery): number {
        return this._state(action, query)?.strength ?? 0;
    }

    /** 0..1 before the deadzone is applied. */
    getActionRawStrength(action: string, query?: DeviceQuery): number {
        return this._state(action, query)?.raw ?? 0;
    }

    /** -1..1: `positive` minus `negative`. */
    getAxis(negative: string, positive: string, query?: DeviceQuery): number {
        return this.getActionStrength(positive, query) - this.getActionStrength(negative, query);
    }

    /**
     * A 2D direction from four actions, with a circular deadzone and length at most 1 (diagonals
     * aren't faster). Y is positive towards `positiveY`, as in Godot's get_vector("left", "right", "up", "down").
     *
     * @param options.deadzone default: the average of the four actions' deadzones
     * @returns `x` and `y` in -1..1; `{ x: 0, y: 0 }` inside the deadzone
     */
    getVector(negativeX: string, positiveX: string, negativeY: string, positiveY: string, options: DeviceQuery & { deadzone?: number } = {}): {
        /** -1..1, positive towards `positiveX` */
        x: number,
        /** -1..1, positive towards `positiveY` */
        y: number,
    } {
        const names = [negativeX, positiveX, negativeY, positiveY];
        const raw = names.map(name => this.getActionRawStrength(name, options));

        const deadzone = options.deadzone
            ?? names.reduce((sum, name) => sum + (this.actions.get(name)?.deadzone ?? 0), 0) / 4;

        let x = raw[1] - raw[0];
        let y = raw[3] - raw[2];

        const length = Math.hypot(x, y);

        if (length <= deadzone) return { x: 0, y: 0 };

        const scale = (Math.min(length, 1) - deadzone) / (1 - deadzone) / length;

        x *= scale;
        y *= scale;

        return { x, y };
    }

    /**
     * Calls `callback` when the action is pressed or released (during update()). With
     * {@link Action.repeat}, `'pressed'` also fires on each auto-repeat, with `event.repeat` set.
     * Returns an unsubscribe function.
     */
    onAction(action: string, phase: ActionPhase, callback: (event: ActionEvent) => void, query: DeviceQuery = {}): () => void {
        const listener = { action, phase, device: query.device ?? ANY, callback };

        this._actionListeners.push(listener);

        return () => {
            const i = this._actionListeners.indexOf(listener);
            if (i >= 0) this._actionListeners.splice(i, 1);
        };
    }

    // ---- raw device state ----

    /** Whether a key (by `KeyboardEvent.code`) is held right now, regardless of actions. */
    isKeyPressed(code: string): boolean {
        return (this._controls.get(0)!.get(`key:${code}`)?.value ?? 0) > 0;
    }

    /** Whether a mouse or pen button is held right now, regardless of actions. */
    isMouseButtonPressed(button: MouseButton): boolean {
        return (this._controls.get(0)!.get(`mouse:${button}`)?.value ?? 0) > 0;
    }

    /**
     * Releases every held key and button, on one device or all. Keyboard, mouse and touch (device 0)
     * are released automatically when the window loses focus, since their release events get lost.
     */
    releaseAll(device?: InputDevice): void {
        if (device === undefined || device === 0) this.gestureRecognizer.clear();

        for (const [d, controls] of this._controls) {
            if (device !== undefined && d !== device) continue;

            for (const state of controls.values()) {
                state.value = 0;
                state.suppressed = false;
            }
        }
    }

    // ---- pointer lock ----

    /** Requests pointer lock on the target (browsers only allow it from a user gesture, e.g. a click). */
    lockPointer(): void {
        (this.input.target as Element).requestPointerLock?.();
    }

    /** Exits pointer lock if the target holds it. */
    unlockPointer(): void {
        if (this.isPointerLocked) document.exitPointerLock();
    }

    // ---- rebinding ----

    /**
     * Waits for the player's next input and resolves with a binding for it, for rebinding menus.
     * Resolves `null` if the cancel key is pressed or another capture starts. The captured press
     * doesn't trigger any actions.
     */
    captureBinding(options: CaptureOptions = {}): Promise<Binding | null> {
        this.cancelCapture();

        return new Promise(resolve => {
            this._capture = { options, resolve };
        });
    }

    /** Ends a pending {@link InputActionMap.captureBinding}, resolving it with `null`. */
    cancelCapture(): void {
        const capture = this._capture;

        this._capture = undefined;
        capture?.resolve(null);
    }

    /**
     * Loads the keyboard layout (where supported, e.g. Chromium) so {@link bindingLabel} names keys
     * as printed on the player's keyboard: KeyW is "Z" on AZERTY.
     */
    async loadKeyboardLayout(): Promise<ReadonlyMap<string, string> | undefined> {
        const keyboard = (globalThis.navigator as { keyboard?: { getLayoutMap?: () => Promise<ReadonlyMap<string, string>> } } | undefined)?.keyboard;

        try {
            this._keyLabels = await keyboard?.getLayoutMap?.();
        } catch {
            this._keyLabels = undefined;
        }

        return this._keyLabels;
    }

    /** The layout loaded by {@link InputActionMap.loadKeyboardLayout}, if any: `KeyboardEvent.code` to printed key. */
    get keyLabels(): ReadonlyMap<string, string> | undefined { return this._keyLabels; }

    /** Removes all event listeners and action callbacks, cancels any capture and detaches XR. */
    dispose(): void {
        for (const [type, listener] of this._listeners) this.input.off(type, listener);

        this._listeners.length = 0;
        this._actionListeners.length = 0;
        this.cancelCapture();
        this.detachXR();
    }

    // ---- internals ----

    private _listen(type: string, listener: (...args: any[]) => void) {
        this.input.on(type, listener);
        this._listeners.push([type, listener]);
    }

    private _state(action: string, query?: DeviceQuery): ActionState | undefined {
        if (!this.actions.has(action)) {
            if (!this._warned.has(action)) {
                this._warned.add(action);
                console.warn(`InputActionMap: unknown action "${action}"`);
            }

            return undefined;
        }

        return this._actionStates.get(action)?.get(query?.device ?? ANY);
    }

    // returns the phase to report: a press (new or auto-repeated) or a release
    private _advance(states: Map<InputDevice, ActionState>, device: InputDevice, raw: number, action: Action, time: number): ActionPhase | undefined {
        const deadzone = action.deadzone;

        let state = states.get(device);
        if (!state) states.set(device, state = { raw: 0, strength: 0, pressed: false, wasPressed: false, repeated: false, nextRepeat: 0 });

        state.wasPressed = state.pressed;
        state.repeated = false;
        state.raw = raw;
        state.pressed = raw > 0 && raw >= deadzone;
        state.strength = !state.pressed ? 0 : deadzone >= 1 ? 1 : Math.min(1, (raw - deadzone) / (1 - deadzone));

        // a digital press always reads as full strength, even with a large deadzone
        if (state.pressed && raw >= 1) state.strength = 1;

        if (state.pressed !== state.wasPressed) {
            if (state.pressed && action.repeat) state.nextRepeat = time + action.repeat.delay;

            return state.pressed ? 'pressed' : 'released';
        }

        // held: repeat at most once per update, and never in a burst to catch up after a stall
        if (state.pressed && action.repeat && time >= state.nextRepeat) {
            const next = state.nextRepeat + action.repeat.interval;

            state.repeated = true;
            state.nextRepeat = next > time ? next : time + action.repeat.interval;

            return 'pressed';
        }

        return undefined;
    }

    private _controlValue(device: InputDevice, id: string): number {
        const state = this._controls.get(device)?.get(id);

        if (!state || state.suppressed) return 0;

        // pressed and already released again since the last frame: still counts as one press
        return state.pressed && state.value < 0.5 ? 1 : state.value;
    }

    private _bindingValue(binding: Binding, device: InputDevice): number {
        const value = this._controlValue(device, controlId(binding));

        if (value === 0 || binding.type !== 'key' || !binding.modifiers) return value;

        const held = (left: string, right: string) =>
            this._controlValue(device, `key:${left}`) > 0 || this._controlValue(device, `key:${right}`) > 0;

        const m = binding.modifiers;

        if (m.shift && !held('ShiftLeft', 'ShiftRight')) return 0;
        if (m.ctrl && !held('ControlLeft', 'ControlRight')) return 0;
        if (m.alt && !held('AltLeft', 'AltRight')) return 0;
        if (m.meta && !held('MetaLeft', 'MetaRight')) return 0;

        return value;
    }

    private _control(device: InputDevice, binding: Binding): ControlState {
        let controls = this._controls.get(device);
        if (!controls) this._controls.set(device, controls = new Map());

        const id = controlId(binding);

        let state = controls.get(id);
        if (!state) controls.set(id, state = { value: 0, pressed: false, suppressed: false });

        return state;
    }

    /** Updates a held control (key, button, axis direction: 0..1); `binding` describes it for captureBinding(). */
    protected _setControl(device: InputDevice, binding: Binding, value: number): void {
        const state = this._control(device, binding);
        const wasDown = state.value >= 0.5;

        state.value = value;

        if (value >= 0.5 && !wasDown) {
            if (this._tryCapture(binding)) state.suppressed = true;
            else state.pressed = true;
        }

        if (value === 0) state.suppressed = false;
    }

    /** A one-frame press with no held state: wheel steps, gestures. */
    protected _pulse(device: InputDevice, binding: Binding): void {
        const state = this._control(device, binding);

        if (!this._tryCapture(binding)) state.pressed = true;
    }

    private _tryCapture(binding: Binding): boolean {
        const capture = this._capture;

        if (!capture) return false;

        const types = capture.options.types;
        const cancelKey = capture.options.cancelKey === undefined ? 'Escape' : capture.options.cancelKey;
        const cancelled = binding.type === 'key' && binding.code === cancelKey;

        if (!cancelled && types && !types.includes(binding.type)) return false;

        this._capture = undefined;
        capture.resolve(cancelled ? null : binding);

        return true;
    }

    private _setLastDevice(type: InputDeviceType): void {
        if (type === this._lastDevice) return;

        this._lastDevice = type;
        this.onDeviceChange.notify(type);
    }

    // ---- gamepads ----

    /**
     * Vibrates a gamepad (where supported). Magnitudes are 0..1; `strong` defaults to 1, `weak` to
     * `strong`, `duration` to 200 ms.
     */
    rumble(device: InputDevice, options: { strong?: number, weak?: number, duration?: number } = {}): void {
        const actuator = (this._gamepads.get(device) as (Gamepad & { vibrationActuator?: { playEffect?: (type: string, params: object) => Promise<unknown> } }) | undefined)?.vibrationActuator;

        actuator?.playEffect?.('dual-rumble', {
            startDelay: 0,
            duration: options.duration ?? 200,
            strongMagnitude: options.strong ?? 1,
            weakMagnitude: options.weak ?? options.strong ?? 1,
        })?.catch(() => { });
    }

    // gamepads must be polled; there are no events for button or stick changes
    private _pollGamepads(): void {
        const navigator = globalThis.navigator as Navigator | undefined;
        const pads = navigator?.getGamepads?.() ?? [];
        const seen = new Set<InputDevice>();

        for (const gamepad of pads) {
            if (!gamepad || !gamepad.connected) continue;

            const device = gamepad.index + 1;
            const isNew = !this._gamepads.has(device);

            seen.add(device);
            this._gamepads.set(device, gamepad);

            if (isNew) this.onGamepadConnected.notify({ device, id: gamepad.id, standard: gamepad.mapping === 'standard' });

            let active = false;

            for (let i = 0; i < GAMEPAD_BUTTONS.length && i < gamepad.buttons.length; i++) {
                const button = gamepad.buttons[i];
                // analog triggers report `pressed` past the browser's own threshold; trust `value`
                // when there is one, and `pressed` only for buttons that report no value
                const value = button.value > 0 ? button.value : button.pressed ? 1 : 0;

                this._setControl(device, { type: 'pad', button: GAMEPAD_BUTTONS[i] }, value);
                active ||= value >= 0.5;
            }

            for (let i = 0; i < GAMEPAD_AXES.length && i < gamepad.axes.length; i++) {
                const value = gamepad.axes[i];

                this._setControl(device, { type: 'padAxis', axis: GAMEPAD_AXES[i], direction: 1 }, Math.max(0, value));
                this._setControl(device, { type: 'padAxis', axis: GAMEPAD_AXES[i], direction: -1 }, Math.max(0, -value));
                active ||= Math.abs(value) >= 0.5;
            }

            if (active) this._setLastDevice('gamepad');
        }

        for (const [device, gamepad] of this._gamepads) {
            if (seen.has(device)) continue;

            // disconnected: release everything it held (released callbacks fire this frame)
            for (const state of this._controls.get(device)?.values() ?? []) {
                state.value = 0;
            }

            this._gamepads.delete(device);
            this.onGamepadDisconnected.notify({ device, id: gamepad.id, standard: gamepad.mapping === 'standard' });
        }
    }

    // ---- touch ----

    private _updateGestures(time: number): void {
        const frame = this.gestureRecognizer.update(time);

        this.gestures.events = frame.events;
        this.gestures.pinch = frame.pinch;
        this.gestures.pan = frame.pan;
        this.gestures.rotate = frame.rotate;

        for (const name of frame.gestures) {
            this._pulse(0, { type: 'gesture', gesture: name });
        }
    }

    // ---- VR controllers ----

    private _xrSession?: XRSessionLike;
    private _xrEnd?: () => void;
    private readonly _xrHeld = new Set<string>(); // control ids the controllers currently drive

    /** The session set by {@link InputActionMap.attachXR}, until detached or ended. */
    get xrSession(): XRSessionLike | undefined { return this._xrSession; }

    /**
     * Reads VR controller buttons and sticks from a WebXR session (e.g. `renderer.xr.getSession()`)
     * into the action map. Controller poses stay with three.js (`renderer.xr.getController(i)`).
     * XR controller state only updates during XR frames, so call update() from the XR animation
     * loop (`renderer.setAnimationLoop`). Detaches automatically when the session ends.
     */
    attachXR(session: XRSessionLike): void {
        this.detachXR();

        this._xrSession = session;
        this._xrEnd = () => this.detachXR();
        session.addEventListener('end', this._xrEnd);
    }

    /** Stops reading the XR session and releases its controls. */
    detachXR(): void {
        if (this._xrSession && this._xrEnd) this._xrSession.removeEventListener('end', this._xrEnd);

        this._xrSession = undefined;
        this._xrEnd = undefined;
        this._releaseXR(new Set());
    }

    private _pollXR(): void {
        const session = this._xrSession;

        if (!session) return;

        const held = new Set<string>();
        let active = false;

        for (const source of session.inputSources) {
            const hand = source.handedness as XRHand;
            const gamepad = source.gamepad;

            if ((hand !== 'left' && hand !== 'right') || !gamepad) continue;

            for (let i = 0; i < XR_BUTTONS.length && i < gamepad.buttons.length; i++) {
                const button = gamepad.buttons[i];
                const value = button.value > 0 ? button.value : button.pressed ? 1 : 0;
                const binding: Binding = { type: 'xr', hand, button: XR_BUTTONS[i] };

                this._setControl(0, binding, value);
                held.add(controlId(binding));
                active ||= value >= 0.5;
            }

            for (let i = 0; i < XR_AXES.length && i < gamepad.axes.length; i++) {
                const value = gamepad.axes[i];

                for (const direction of [1, -1] as const) {
                    const binding: Binding = { type: 'xrAxis', hand, axis: XR_AXES[i], direction };

                    this._setControl(0, binding, Math.max(0, value * direction));
                    held.add(controlId(binding));
                }

                active ||= Math.abs(value) >= 0.5;
            }
        }

        // a controller that went away (switched off, hand tracking took over) releases its controls
        this._releaseXR(held);

        for (const id of held) this._xrHeld.add(id);

        if (active) this._setLastDevice('xr');
    }

    private _releaseXR(keep: Set<string>): void {
        const controls = this._controls.get(0)!;

        for (const id of this._xrHeld) {
            if (keep.has(id)) continue;

            const state = controls.get(id);
            if (state) state.value = 0;

            this._xrHeld.delete(id);
        }
    }

    // ---- keyboard ----

    private _isBound(type: Binding['type'], predicate: (binding: Binding) => boolean): boolean {
        for (const name of this.actions.names) {
            if (this.actions.get(name)!.bindings.some(b => b.type === type && predicate(b))) return true;
        }

        return false;
    }

    private _onKeyDown(event: KeyboardEvent): void {
        if (isEditable(event.target)) return;

        if (this._options.preventDefault && this._isBound('key', b => b.type === 'key' && b.code === event.code)) {
            event.preventDefault();
        }

        this._setLastDevice('keyboard');

        if (event.repeat) return;

        this._setControl(0, { type: 'key', code: event.code }, 1);
    }

    private _onKeyUp(event: KeyboardEvent): void {
        this._setControl(0, { type: 'key', code: event.code }, 0);
    }

    // ---- mouse and pen ----

    private _updatePointer(event: PointerEvent): void {
        this.pointer.type = event.pointerType === 'pen' ? 'pen' : 'mouse';
        this.pointer.x = this.input.pointerPosition.x;
        this.pointer.y = this.input.pointerPosition.y;
        this.pointer.ndcX = this.input.pointerPositionNdc.x;
        this.pointer.ndcY = this.input.pointerPositionNdc.y;
        this.pointer.pressure = event.pressure ?? 0;
        this.pointer.tiltX = event.tiltX ?? 0;
        this.pointer.tiltY = event.tiltY ?? 0;
    }

    private _local(event: PointerEvent): { x: number, y: number } {
        const rect = (this.input.target as Element).getBoundingClientRect?.();

        return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
    }

    // mouse and pen buttons; Input also reports the primary finger as button 0, which touch handles itself
    private _onButton(event: PointerEvent, value: number): void {
        if (event.pointerType === 'touch') return;

        this._updatePointer(event);
        this._setLastDevice(event.pointerType === 'pen' ? 'pen' : 'mouse');

        const button = MOUSE_BUTTONS[event.button];

        if (button) this._setControl(0, { type: 'mouse', button }, value);
    }

    private _onPointerMove(event: PointerEvent): void {
        if (event.pointerType === 'touch') return;

        this._updatePointer(event);
        this._setLastDevice(event.pointerType === 'pen' ? 'pen' : 'mouse');

        this._pending.deltaX += event.movementX ?? 0;
        this._pending.deltaY += event.movementY ?? 0;
    }

    private _onTouchDown(event: PointerEvent): void {
        const { x, y } = this._local(event);

        this.gestureRecognizer.down(event.pointerId, x, y, now());
        this._setLastDevice('touch');
    }

    private _onTouchMove(event: PointerEvent): void {
        const { x, y } = this._local(event);

        this.gestureRecognizer.move(event.pointerId, x, y);
    }

    private _onTouchUp(event: PointerEvent): void {
        const { x, y } = this._local(event);

        this.gestureRecognizer.up(event.pointerId, x, y, now());
    }

    private _onWheel(event: WheelEvent): void {
        const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 800 : 1; // lines / pages -> pixels
        const dx = event.deltaX * scale;
        const dy = event.deltaY * scale;

        this._pending.wheelX += dx;
        this._pending.wheelY += dy;

        if (this._options.preventDefault && this._isBound('wheel', () => true)) {
            event.preventDefault();
        }

        if (dy < 0) this._pulse(0, { type: 'wheel', direction: 'up' });
        if (dy > 0) this._pulse(0, { type: 'wheel', direction: 'down' });
        if (dx < 0) this._pulse(0, { type: 'wheel', direction: 'left' });
        if (dx > 0) this._pulse(0, { type: 'wheel', direction: 'right' });
    }
}
