import { Observable } from '../observable';
import { ActionMap } from './action-map';
import { type Binding, type MouseButton, controlId } from './bindings';

/** 0 = keyboard, mouse, pen, touch and VR; 1, 2, ... = gamepads. */
export type InputDevice = number;

export type InputDeviceType = 'keyboard' | 'mouse' | 'pen' | 'touch' | 'gamepad' | 'xr';

export type ActionPhase = 'pressed' | 'released';

export interface InputOptions {
    keyboardTarget?: EventTarget,   // where key events are read; default: window
    defaults?: boolean,             // add the ui_* actions. Default true.
    preventDefault?: boolean,       // stop bound keys / the wheel from scrolling the page. Default true.
    preventContextMenu?: boolean,   // no right-click menu on the target. Default true.
}

export interface DeviceQuery {
    device?: InputDevice,           // only this device; default: any
}

export interface PointerState {
    type: 'mouse' | 'pen',
    x: number, y: number,           // pixels, relative to the target's top-left
    ndcX: number, ndcY: number,     // -1..1, y up (for raycasting)
    deltaX: number, deltaY: number, // movement during the last frame (works under pointer lock)
    wheelX: number, wheelY: number, // wheel movement during the last frame, in pixels
    pressure: number,               // pen: 0..1
    tiltX: number, tiltY: number,   // pen: degrees
}

export interface CaptureOptions {
    cancelKey?: string | null,      // KeyboardEvent.code that cancels (resolves null). Default 'Escape'.
    types?: Binding['type'][],      // only accept these kinds of input
}

interface ControlState {
    value: number,       // 0..1
    pressed: boolean,    // went down since the last update (so a press + release between frames still counts)
    suppressed: boolean, // used to answer captureBinding(); ignored until released
}

interface ActionState {
    raw: number,
    strength: number,
    pressed: boolean,
    wasPressed: boolean,
}

const ANY = -1;

// indexed by PointerEvent.button; BUTTON_BITS gives each one's bit in PointerEvent.buttons
const MOUSE_BUTTONS: readonly MouseButton[] = ['left', 'middle', 'right', 'back', 'forward'];
const BUTTON_BITS = [1, 4, 2, 8, 16];

const isEditable = (target: EventTarget | null): boolean => {
    const element = target as HTMLElement | null;
    const tag = element?.tagName;

    return !!element && (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || element.isContentEditable === true);
};

/**
 * Game input with a Godot-style action map: bind keys, buttons, sticks, gestures and VR controls
 * to named actions, then query actions instead of devices.
 *
 *     const input = new Input(canvas);
 *     input.actions.add('jump', [key('Space'), pad('A')]);
 *
 *     // every frame, before game logic:
 *     input.update();
 *     if (input.isActionJustPressed('jump')) player.jump();
 *
 * Call `dispose()` to remove all listeners.
 */
export class Input {
    readonly actions = new ActionMap();

    readonly pointer: PointerState = {
        type: 'mouse', x: 0, y: 0, ndcX: 0, ndcY: 0, deltaX: 0, deltaY: 0, wheelX: 0, wheelY: 0, pressure: 0, tiltX: 0, tiltY: 0,
    };

    readonly onDeviceChange = new Observable<InputDeviceType>();

    private _lastDevice: InputDeviceType = 'keyboard';
    private _keyLabels?: ReadonlyMap<string, string>;

    private readonly _target?: EventTarget;
    private readonly _options: Required<Omit<InputOptions, 'keyboardTarget'>>;
    private readonly _listeners: [EventTarget, string, EventListener, AddEventListenerOptions?][] = [];

    // device -> control id -> state
    private readonly _controls = new Map<InputDevice, Map<string, ControlState>>([[0, new Map()]]);
    // action -> device (or ANY) -> state
    private readonly _actionStates = new Map<string, Map<InputDevice, ActionState>>();
    private readonly _actionListeners: { action: string, phase: ActionPhase, device: InputDevice, callback: () => void }[] = [];
    private readonly _warned = new Set<string>();

    private readonly _pending = { deltaX: 0, deltaY: 0, wheelX: 0, wheelY: 0 };

    private _capture?: { options: CaptureOptions, resolve: (binding: Binding | null) => void };

    get lastDevice(): InputDeviceType { return this._lastDevice; }

    get isPointerLocked(): boolean {
        return typeof document !== 'undefined' && !!this._target && document.pointerLockElement === this._target;
    }

    /**
     * @param target element that receives pointer, wheel and touch input (usually the canvas)
     */
    constructor(target?: EventTarget, options: InputOptions = {}) {
        this._target = target;
        this._options = {
            defaults: options.defaults ?? true,
            preventDefault: options.preventDefault ?? true,
            preventContextMenu: options.preventContextMenu ?? true,
        };

        if (this._options.defaults) this.actions.addDefaults();

        const keyboard = options.keyboardTarget ?? (typeof window !== 'undefined' ? window : undefined);

        if (keyboard) {
            this._listen(keyboard, 'keydown', e => this._onKeyDown(e as KeyboardEvent));
            this._listen(keyboard, 'keyup', e => this._onKeyUp(e as KeyboardEvent));
            this._listen(keyboard, 'blur', () => this.releaseAll());
        }

        if (typeof document !== 'undefined') {
            this._listen(document, 'visibilitychange', () => { if (document.hidden) this.releaseAll(); });
        }

        if (target) {
            this._listen(target, 'pointerdown', e => this._onPointerDown(e as PointerEvent));
            this._listen(target, 'pointerup', e => this._onPointerUp(e as PointerEvent));
            this._listen(target, 'pointercancel', e => this._onPointerUp(e as PointerEvent));
            this._listen(target, 'pointermove', e => this._onPointerMove(e as PointerEvent));
            this._listen(target, 'wheel', e => this._onWheel(e as WheelEvent), { passive: false });
            this._listen(target, 'contextmenu', e => { if (this._options.preventContextMenu) e.preventDefault(); });
        }
    }

    /**
     * Call once per frame, before reading input: polls devices and advances "just pressed" /
     * "just released" by one frame. Action callbacks fire from here.
     */
    update(): void {
        // pointer movement and wheel accumulated since the last frame
        this.pointer.deltaX = this._pending.deltaX;
        this.pointer.deltaY = this._pending.deltaY;
        this.pointer.wheelX = this._pending.wheelX;
        this.pointer.wheelY = this._pending.wheelY;
        this._pending.deltaX = this._pending.deltaY = this._pending.wheelX = this._pending.wheelY = 0;

        const devices = [...this._controls.keys()];
        const fired: { action: string, phase: ActionPhase, device: InputDevice }[] = [];

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

                if (this._advance(states, device, raw, action.deadzone)) {
                    fired.push({ action: name, phase: states.get(device)!.pressed ? 'pressed' : 'released', device });
                }
            }

            if (this._advance(states, ANY, anyRaw, action.deadzone)) {
                fired.push({ action: name, phase: states.get(ANY)!.pressed ? 'pressed' : 'released', device: ANY });
            }
        }

        // presses are consumed once actions have seen them
        for (const controls of this._controls.values()) {
            for (const state of controls.values()) state.pressed = false;
        }

        for (const { action, phase, device } of fired) {
            for (const listener of [...this._actionListeners]) {
                if (listener.action === action && listener.phase === phase && listener.device === device) {
                    listener.callback();
                }
            }
        }
    }

    // ---- actions ----

    isActionPressed(action: string, query?: DeviceQuery): boolean {
        return this._state(action, query)?.pressed ?? false;
    }

    isActionJustPressed(action: string, query?: DeviceQuery): boolean {
        const state = this._state(action, query);
        return !!state && state.pressed && !state.wasPressed;
    }

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
     * @param deadzone default: the average of the four actions' deadzones
     */
    getVector(negativeX: string, positiveX: string, negativeY: string, positiveY: string, options: DeviceQuery & { deadzone?: number } = {}): { x: number, y: number } {
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

    /** Calls `callback` when the action is pressed or released (during update()). Returns an unsubscribe function. */
    onAction(action: string, phase: ActionPhase, callback: () => void, query: DeviceQuery = {}): () => void {
        const listener = { action, phase, device: query.device ?? ANY, callback };

        this._actionListeners.push(listener);

        return () => {
            const i = this._actionListeners.indexOf(listener);
            if (i >= 0) this._actionListeners.splice(i, 1);
        };
    }

    // ---- raw device state ----

    isKeyPressed(code: string): boolean {
        return (this._controls.get(0)!.get(`key:${code}`)?.value ?? 0) > 0;
    }

    isMouseButtonPressed(button: MouseButton): boolean {
        return (this._controls.get(0)!.get(`mouse:${button}`)?.value ?? 0) > 0;
    }

    /** Releases every held key and button (also happens automatically when the window loses focus). */
    releaseAll(): void {
        for (const controls of this._controls.values()) {
            for (const state of controls.values()) {
                state.value = 0;
                state.suppressed = false;
            }
        }
    }

    // ---- pointer lock ----

    lockPointer(): void {
        (this._target as Element | undefined)?.requestPointerLock?.();
    }

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

    cancelCapture(): void {
        const capture = this._capture;

        this._capture = undefined;
        capture?.resolve(null);
    }

    /**
     * Loads the keyboard layout (where supported, e.g. Chromium) so `bindingLabel()` names keys
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

    get keyLabels(): ReadonlyMap<string, string> | undefined { return this._keyLabels; }

    dispose(): void {
        for (const [target, type, listener, options] of this._listeners) {
            target.removeEventListener(type, listener, options);
        }

        this._listeners.length = 0;
        this._actionListeners.length = 0;
        this.cancelCapture();
    }

    // ---- internals ----

    private _listen(target: EventTarget, type: string, listener: EventListener, options?: AddEventListenerOptions) {
        target.addEventListener(type, listener, options);
        this._listeners.push([target, type, listener, options]);
    }

    private _state(action: string, query?: DeviceQuery): ActionState | undefined {
        if (!this.actions.has(action)) {
            if (!this._warned.has(action)) {
                this._warned.add(action);
                console.warn(`Input: unknown action "${action}"`);
            }

            return undefined;
        }

        return this._actionStates.get(action)?.get(query?.device ?? ANY);
    }

    // returns true when the pressed state changed
    private _advance(states: Map<InputDevice, ActionState>, device: InputDevice, raw: number, deadzone: number): boolean {
        let state = states.get(device);
        if (!state) states.set(device, state = { raw: 0, strength: 0, pressed: false, wasPressed: false });

        state.wasPressed = state.pressed;
        state.raw = raw;
        state.pressed = raw > 0 && raw >= deadzone;
        state.strength = !state.pressed ? 0 : deadzone >= 1 ? 1 : Math.min(1, (raw - deadzone) / (1 - deadzone));

        // a digital press always reads as full strength, even with a large deadzone
        if (state.pressed && raw >= 1) state.strength = 1;

        return state.pressed !== state.wasPressed;
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
        const rect = (this._target as Element | undefined)?.getBoundingClientRect?.();
        const left = rect?.left ?? 0;
        const top = rect?.top ?? 0;
        const width = rect?.width || 1;
        const height = rect?.height || 1;

        this.pointer.type = event.pointerType === 'pen' ? 'pen' : 'mouse';
        this.pointer.x = event.clientX - left;
        this.pointer.y = event.clientY - top;
        this.pointer.ndcX = (this.pointer.x / width) * 2 - 1;
        this.pointer.ndcY = -((this.pointer.y / height) * 2 - 1);
        this.pointer.pressure = event.pressure ?? 0;
        this.pointer.tiltX = event.tiltX ?? 0;
        this.pointer.tiltY = event.tiltY ?? 0;
    }

    private _onPointerDown(event: PointerEvent): void {
        if (event.pointerType === 'touch') return; // touch: stage 3

        this._updatePointer(event);
        this._setLastDevice(event.pointerType === 'pen' ? 'pen' : 'mouse');

        const button = MOUSE_BUTTONS[event.button];

        if (button) this._setControl(0, { type: 'mouse', button }, 1);

        // keep receiving the release even if it happens outside the target
        (this._target as Element | undefined)?.setPointerCapture?.(event.pointerId);
    }

    private _onPointerUp(event: PointerEvent): void {
        if (event.pointerType === 'touch') return;

        this._updatePointer(event);

        const button = MOUSE_BUTTONS[event.button];

        if (button) this._setControl(0, { type: 'mouse', button }, 0);
    }

    private _onPointerMove(event: PointerEvent): void {
        if (event.pointerType === 'touch') return;

        this._updatePointer(event);
        this._setLastDevice(event.pointerType === 'pen' ? 'pen' : 'mouse');

        this._pending.deltaX += event.movementX ?? 0;
        this._pending.deltaY += event.movementY ?? 0;

        // "chorded" presses: a button pressed or released while another is held arrives as a
        // pointermove with `button` set to the button that changed (and no pointerdown/up)
        const button = MOUSE_BUTTONS[event.button];

        if (button) {
            const down = ((event.buttons ?? 0) & BUTTON_BITS[event.button]) !== 0;
            this._setControl(0, { type: 'mouse', button }, down ? 1 : 0);
        }
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
