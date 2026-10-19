// Bindings are plain JSON-serializable objects, so action maps (and players' rebinds) can be saved.

/**
 * Modifier keys that must also be held for a key {@link Binding} to count (left or right side).
 * Modifiers left out are not checked, so a binding without `ctrl` still fires while Ctrl is held.
 *
 * @category Input
 */
export interface KeyModifiers {
    /** require Shift */
    shift?: boolean,
    /** require Ctrl */
    ctrl?: boolean,
    /** require Alt */
    alt?: boolean,
    /** require Meta (Windows / Command key) */
    meta?: boolean,
}

/**
 * A mouse or pen button, as numbered by `PointerEvent.button` (0 to 4).
 *
 * @category Input
 */
export type MouseButton = 'left' | 'middle' | 'right' | 'back' | 'forward';
/**
 * A mouse wheel direction.
 *
 * @category Input
 */
export type WheelDirection = 'up' | 'down' | 'left' | 'right';

/**
 * W3C "standard" gamepad mapping, in button-index order (Xbox names; on PlayStation A = Cross,
 * B = Circle, X = Square, Y = Triangle).
 *
 * @category Input
 */
export const GAMEPAD_BUTTONS = [
    'A', 'B', 'X', 'Y',
    'LB', 'RB', 'LT', 'RT',
    'Select', 'Start',
    'LS', 'RS', // stick presses
    'DpadUp', 'DpadDown', 'DpadLeft', 'DpadRight',
    'Home',
] as const;

/**
 * A gamepad button name from {@link GAMEPAD_BUTTONS}.
 *
 * @category Input
 */
export type GamepadButton = typeof GAMEPAD_BUTTONS[number];

/**
 * Standard-mapping gamepad stick axes, in axis-index order; Y is positive downwards.
 *
 * @category Input
 */
export const GAMEPAD_AXES = ['leftX', 'leftY', 'rightX', 'rightY'] as const; // Y is positive downwards

/**
 * A gamepad axis name from {@link GAMEPAD_AXES}.
 *
 * @category Input
 */
export type GamepadAxis = typeof GAMEPAD_AXES[number];

/**
 * The touch gestures recognized by {@link GestureRecognizer}.
 *
 * @category Input
 */
export const GESTURES = [
    'tap', 'doubleTap', 'longPress',
    'swipeLeft', 'swipeRight', 'swipeUp', 'swipeDown',
    'pinchIn', 'pinchOut',
] as const;

/**
 * A gesture name from {@link GESTURES}.
 *
 * @category Input
 */
export type Gesture = typeof GESTURES[number];

/**
 * Which hand a VR controller is held in.
 *
 * @category Input
 */
export type XRHand = 'left' | 'right';

/**
 * WebXR "xr-standard" controller buttons, in button-index order; A/X and B/Y are the
 * primary/secondary face buttons of each hand.
 *
 * @category Input
 */
export const XR_BUTTONS = ['trigger', 'squeeze', 'touchpad', 'thumbstick', 'primary', 'secondary'] as const;

/**
 * A VR controller button name from {@link XR_BUTTONS}.
 *
 * @category Input
 */
export type XRButton = typeof XR_BUTTONS[number];

/**
 * WebXR "xr-standard" controller axes (touchpad, thumbstick), in axis-index order; Y is positive downwards.
 *
 * @category Input
 */
export const XR_AXES = ['padX', 'padY', 'thumbX', 'thumbY'] as const; // Y is positive downwards

/**
 * A VR controller axis name from {@link XR_AXES}.
 *
 * @category Input
 */
export type XRAxis = typeof XR_AXES[number];

/**
 * A keyboard key, made with {@link key}.
 *
 * @category Input
 */
export interface KeyBinding {
    /** always 'key' */
    type: 'key',
    /** `KeyboardEvent.code`, e.g. 'KeyW' (layout independent) */
    code: string,
    /** modifiers that must also be held, see {@link KeyModifiers} */
    modifiers?: KeyModifiers,
}

/**
 * A mouse (or pen) button, made with {@link mouse}.
 *
 * @category Input
 */
export interface MouseBinding {
    /** always 'mouse' */
    type: 'mouse',
    /** which button */
    button: MouseButton,
}

/**
 * A wheel direction, made with {@link wheel}.
 *
 * @category Input
 */
export interface WheelBinding {
    /** always 'wheel' */
    type: 'wheel',
    /** which way the wheel moves */
    direction: WheelDirection,
}

/**
 * A gamepad button (standard mapping), made with {@link pad}.
 *
 * @category Input
 */
export interface PadBinding {
    /** always 'pad' */
    type: 'pad',
    /** button name from the standard mapping */
    button: GamepadButton,
}

/**
 * One half of a gamepad stick axis, made with {@link padAxis}.
 *
 * @category Input
 */
export interface PadAxisBinding {
    /** always 'padAxis' */
    type: 'padAxis',
    /** which stick axis */
    axis: GamepadAxis,
    /** 1 = positive half (right / down), -1 = negative half (left / up) */
    direction: 1 | -1,
}

/**
 * A touch gesture, made with {@link gesture}.
 *
 * @category Input
 */
export interface GestureBinding {
    /** always 'gesture' */
    type: 'gesture',
    /** which gesture */
    gesture: Gesture,
}

/**
 * A VR controller button, made with {@link xr}.
 *
 * @category Input
 */
export interface XRBinding {
    /** always 'xr' */
    type: 'xr',
    /** which controller */
    hand: XRHand,
    /** button name from the xr-standard mapping */
    button: XRButton,
}

/**
 * One half of a VR controller axis, made with {@link xrAxis}.
 *
 * @category Input
 */
export interface XRAxisBinding {
    /** always 'xrAxis' */
    type: 'xrAxis',
    /** which controller */
    hand: XRHand,
    /** which touchpad or thumbstick axis */
    axis: XRAxis,
    /** 1 = positive half (right / down), -1 = negative half (left / up) */
    direction: 1 | -1,
}

/**
 * One physical input that can trigger an action: a plain, JSON-serializable object, usually made
 * with {@link key}, {@link mouse}, {@link wheel}, {@link pad}, {@link padAxis}, {@link gesture},
 * {@link xr} or {@link xrAxis}. `type` selects the variant.
 *
 * @category Input
 */
export type Binding = KeyBinding | MouseBinding | WheelBinding | PadBinding
    | PadAxisBinding | GestureBinding | XRBinding | XRAxisBinding;

/**
 * A physical key, by `KeyboardEvent.code` (layout independent: 'KeyW' is W on QWERTY, Z on AZERTY).
 *
 * @category Input
 */
export const key = (code: string, modifiers?: KeyModifiers): KeyBinding =>
    modifiers ? { type: 'key', code, modifiers } : { type: 'key', code };

/**
 * A mouse (or pen) button.
 *
 * @category Input
 */
export const mouse = (button: MouseButton): MouseBinding => ({ type: 'mouse', button });

/**
 * A wheel direction: pressed for one frame whenever the wheel moves that way.
 *
 * @category Input
 */
export const wheel = (direction: WheelDirection): WheelBinding => ({ type: 'wheel', direction });

/**
 * A gamepad button (standard mapping).
 *
 * @category Input
 */
export const pad = (button: GamepadButton): PadBinding => ({ type: 'pad', button });

/**
 * One direction of a gamepad stick axis, e.g. padAxis('leftX', -1) for "left stick left".
 *
 * @category Input
 */
export const padAxis = (axis: GamepadAxis, direction: 1 | -1): PadAxisBinding => ({ type: 'padAxis', axis, direction });

/**
 * A touch gesture.
 *
 * @category Input
 */
export const gesture = (name: Gesture): GestureBinding => ({ type: 'gesture', gesture: name });

/**
 * A VR controller button.
 *
 * @category Input
 */
export const xr = (hand: XRHand, button: XRButton): XRBinding => ({ type: 'xr', hand, button });

/**
 * One direction of a VR controller axis.
 *
 * @category Input
 */
export const xrAxis = (hand: XRHand, axis: XRAxis, direction: 1 | -1): XRAxisBinding => ({ type: 'xrAxis', hand, axis, direction });

/**
 * Identifies the physical control behind a binding (modifiers aside), e.g. `'key:KeyW'` or
 * `'padAxis:leftX:-1'`.
 *
 * @category Input
 */
export function controlId(binding: Binding): string {
    switch (binding.type) {
        case 'key': return `key:${binding.code}`;
        case 'mouse': return `mouse:${binding.button}`;
        case 'wheel': return `wheel:${binding.direction}`;
        case 'pad': return `pad:${binding.button}`;
        case 'padAxis': return `padAxis:${binding.axis}:${binding.direction}`;
        case 'gesture': return `gesture:${binding.gesture}`;
        case 'xr': return `xr:${binding.hand}:${binding.button}`;
        case 'xrAxis': return `xrAxis:${binding.hand}:${binding.axis}:${binding.direction}`;
    }
}

/**
 * Whether two bindings refer to the same control; key bindings must also require the same modifiers
 * (a missing modifier counts as `false`).
 *
 * @category Input
 */
export function bindingsEqual(a: Binding, b: Binding): boolean {
    if (controlId(a) !== controlId(b)) return false;
    if (a.type !== 'key' || b.type !== 'key') return true;

    const ma = a.modifiers ?? {};
    const mb = b.modifiers ?? {};

    return !!ma.shift === !!mb.shift && !!ma.ctrl === !!mb.ctrl && !!ma.alt === !!mb.alt && !!ma.meta === !!mb.meta;
}

const KEY_NAMES: Record<string, string> = {
    Space: 'Space', Enter: 'Enter', NumpadEnter: 'Numpad Enter', Escape: 'Esc', Tab: 'Tab', Backspace: 'Backspace',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    ShiftLeft: 'Left Shift', ShiftRight: 'Right Shift', ControlLeft: 'Left Ctrl', ControlRight: 'Right Ctrl',
    AltLeft: 'Left Alt', AltRight: 'Right Alt', MetaLeft: 'Left Meta', MetaRight: 'Right Meta',
};

const AXIS_NAMES: Record<string, [string, string]> = {
    leftX: ['Left Stick Left', 'Left Stick Right'], leftY: ['Left Stick Up', 'Left Stick Down'],
    rightX: ['Right Stick Left', 'Right Stick Right'], rightY: ['Right Stick Up', 'Right Stick Down'],
    padX: ['Touchpad Left', 'Touchpad Right'], padY: ['Touchpad Up', 'Touchpad Down'],
    thumbX: ['Thumbstick Left', 'Thumbstick Right'], thumbY: ['Thumbstick Up', 'Thumbstick Down'],
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * A readable name for a binding, e.g. for "Press Space to jump" prompts. Pass `keyLabels` (from
 * {@link InputActionMap.loadKeyboardLayout}) to name keys as printed on the player's keyboard.
 *
 * @category Input
 */
export function bindingLabel(binding: Binding, keyLabels?: ReadonlyMap<string, string>): string {
    switch (binding.type) {
        case 'key': {
            const m = binding.modifiers ?? {};
            const name = keyLabels?.get(binding.code)?.toUpperCase()
                ?? KEY_NAMES[binding.code]
                ?? binding.code.replace(/^Key|^Digit/, '').replace(/^Numpad(.+)/, 'Numpad $1');

            return [m.ctrl && 'Ctrl', m.alt && 'Alt', m.shift && 'Shift', m.meta && 'Meta', name].filter(Boolean).join('+');
        }
        case 'mouse': return `Mouse ${capitalize(binding.button)}`;
        case 'wheel': return `Wheel ${capitalize(binding.direction)}`;
        case 'pad': return `Gamepad ${binding.button}`;
        case 'padAxis': return AXIS_NAMES[binding.axis][binding.direction > 0 ? 1 : 0];
        case 'gesture': return capitalize(binding.gesture.replace(/([A-Z])/g, ' $1').toLowerCase());
        case 'xr': return `${capitalize(binding.hand)} ${capitalize(binding.button)}`;
        case 'xrAxis': return `${capitalize(binding.hand)} ${AXIS_NAMES[binding.axis][binding.direction > 0 ? 1 : 0]}`;
    }
}
