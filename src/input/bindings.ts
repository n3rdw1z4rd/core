// Bindings are plain JSON-serializable objects, so action maps (and players' rebinds) can be saved.

export interface KeyModifiers {
    shift?: boolean,
    ctrl?: boolean,
    alt?: boolean,
    meta?: boolean,
}

export type MouseButton = 'left' | 'middle' | 'right' | 'back' | 'forward';
export type WheelDirection = 'up' | 'down' | 'left' | 'right';

// W3C "standard" gamepad mapping (Xbox names; on PlayStation A = Cross, B = Circle, X = Square, Y = Triangle)
export const GAMEPAD_BUTTONS = [
    'A', 'B', 'X', 'Y',
    'LB', 'RB', 'LT', 'RT',
    'Select', 'Start',
    'LS', 'RS', // stick presses
    'DpadUp', 'DpadDown', 'DpadLeft', 'DpadRight',
    'Home',
] as const;

export type GamepadButton = typeof GAMEPAD_BUTTONS[number];

export const GAMEPAD_AXES = ['leftX', 'leftY', 'rightX', 'rightY'] as const; // Y is positive downwards

export type GamepadAxis = typeof GAMEPAD_AXES[number];

export const GESTURES = [
    'tap', 'doubleTap', 'longPress',
    'swipeLeft', 'swipeRight', 'swipeUp', 'swipeDown',
    'pinchIn', 'pinchOut',
] as const;

export type Gesture = typeof GESTURES[number];

export type XRHand = 'left' | 'right';

// WebXR "xr-standard" mapping; A/X and B/Y are the primary/secondary face buttons of each hand
export const XR_BUTTONS = ['trigger', 'squeeze', 'touchpad', 'thumbstick', 'primary', 'secondary'] as const;

export type XRButton = typeof XR_BUTTONS[number];

export const XR_AXES = ['padX', 'padY', 'thumbX', 'thumbY'] as const; // Y is positive downwards

export type XRAxis = typeof XR_AXES[number];

export type Binding =
    | { type: 'key', code: string, modifiers?: KeyModifiers }
    | { type: 'mouse', button: MouseButton }
    | { type: 'wheel', direction: WheelDirection }
    | { type: 'pad', button: GamepadButton }
    | { type: 'padAxis', axis: GamepadAxis, direction: 1 | -1 }
    | { type: 'gesture', gesture: Gesture }
    | { type: 'xr', hand: XRHand, button: XRButton }
    | { type: 'xrAxis', hand: XRHand, axis: XRAxis, direction: 1 | -1 };

/** A physical key, by `KeyboardEvent.code` (layout independent: 'KeyW' is W on QWERTY, Z on AZERTY). */
export const key = (code: string, modifiers?: KeyModifiers): Binding =>
    modifiers ? { type: 'key', code, modifiers } : { type: 'key', code };

/** A mouse (or pen) button. */
export const mouse = (button: MouseButton): Binding => ({ type: 'mouse', button });

/** A wheel direction: one press per wheel step. */
export const wheel = (direction: WheelDirection): Binding => ({ type: 'wheel', direction });

/** A gamepad button (standard mapping). */
export const pad = (button: GamepadButton): Binding => ({ type: 'pad', button });

/** One direction of a gamepad stick axis, e.g. padAxis('leftX', -1) for "left stick left". */
export const padAxis = (axis: GamepadAxis, direction: 1 | -1): Binding => ({ type: 'padAxis', axis, direction });

/** A touch gesture. */
export const gesture = (name: Gesture): Binding => ({ type: 'gesture', gesture: name });

/** A VR controller button. */
export const xr = (hand: XRHand, button: XRButton): Binding => ({ type: 'xr', hand, button });

/** One direction of a VR controller axis. */
export const xrAxis = (hand: XRHand, axis: XRAxis, direction: 1 | -1): Binding => ({ type: 'xrAxis', hand, axis, direction });

/** Identifies the physical control behind a binding (modifiers aside). */
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
 * `Input.loadKeyboardLayout()`) to name keys as printed on the player's keyboard.
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
