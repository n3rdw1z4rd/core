import { Emitter } from './emitter';

/** Pressed/released state for a single key or mouse button, with the timestamp of the last change. */
export interface InputState {
    state: number,
    timeStamp: number,
}

/** Modifier-key and timing fields common to keyboard/mouse/wheel events, forwarded on every emitted event. */
export interface CommonEventProps {
    timeStamp: number,
    altKey: boolean,
    ctrlKey: boolean,
    metaKey: boolean,
    shiftKey: boolean,
}

/**
 * Global keyboard/mouse input tracker. Listens on `window` and re-emits
 * (via {@link Emitter}) both generic events (`key_down`, `mouse_move`, ...)
 * and per-key/per-button variants (e.g. `space_down`, `mouse_button_0_up`).
 * Also tracks current key/button state for polling via {@link isKeyDown}
 * etc, alongside the emitted events. Right-click/context-menu suppression
 * is opt-in via {@link blockContextMenu}.
 */
export class Input extends Emitter {
    /** Max milliseconds between down and up for a `*_pressed`/`*_clicked` event to also fire. */
    public inputThreshold: number = 200;
    private _keyStates: { [key: string]: InputState } = {};
    private _mouseButtonStates: { [key: number]: InputState } = {};

    private _mousePosition: [number, number] = [0, 0];
    private _mousePosition2: [number, number] = [0, 0];

    private _contextMenuTarget: EventTarget | undefined;

    /** Mouse position in canvas/element-relative pixels (`offsetX`/`offsetY`). */
    public get mousePosition(): [number, number] { return this._mousePosition; }
    /** Mouse position normalized to `[-1, 1]` on both axes, Y-up (the convention WebGL/Three.js expects for e.g. raycasting). */
    public get mousePosition2(): [number, number] { return this._mousePosition2; }

    constructor() {
        super();

        window.addEventListener('keydown', this._onKeyDown.bind(this) as EventListener);
        window.addEventListener('keyup', this._onKeyUp.bind(this) as EventListener);
        window.addEventListener('mousedown', this._onMouseButtonDown.bind(this) as EventListener);
        window.addEventListener('mouseup', this._onMouseButtonUp.bind(this) as EventListener);
        window.addEventListener('mousemove', this._onMouseMove.bind(this) as EventListener);
        window.addEventListener('wheel', this._onWheel.bind(this) as EventListener);
    }

    /**
     * Opt-in: prevents the native browser context menu from appearing on
     * `target` (e.g. your game canvas) and emits a `contextmenu` event
     * instead, so you can handle right-click yourself. Not enabled by
     * default, since blocking the context menu globally would be too
     * aggressive for most pages - call this explicitly (typically with
     * your canvas element) to opt in. Call {@link stopBlockingContextMenu}
     * to undo it.
     */
    public blockContextMenu(target: EventTarget): void {
        this.stopBlockingContextMenu();

        this._contextMenuTarget = target;
        target.addEventListener('contextmenu', this._onContextMenu as EventListener);
    }

    /** Undoes {@link blockContextMenu}, restoring the native context menu on whatever target it was attached to. */
    public stopBlockingContextMenu(): void {
        this._contextMenuTarget?.removeEventListener('contextmenu', this._onContextMenu as EventListener);
        this._contextMenuTarget = undefined;
    }

    private _onContextMenu = (ev: Event): void => {
        ev.preventDefault();
        this.emit('contextmenu');
    };

    private _getCommonEventProps(ev: KeyboardEvent | MouseEvent | WheelEvent): CommonEventProps {
        const props: CommonEventProps = {
            timeStamp: ev.timeStamp,
            altKey: ev.altKey,
            ctrlKey: ev.ctrlKey,
            metaKey: ev.metaKey,
            shiftKey: ev.shiftKey,
        };

        return props;
    }

    private _onKeyDown(ev: KeyboardEvent) {
        const props = this._getCommonEventProps(ev);

        const { code, key } = ev;

        if (!ev.repeat) {
            this._keyStates[code] = { state: 1, timeStamp: props.timeStamp };
            this.emit('key_down', { ...props, code, key });
            this.emit(`${code.toLowerCase()}_down`, props);
        }
    }

    private _onKeyUp(ev: KeyboardEvent) {
        const props = this._getCommonEventProps(ev);

        const { code, key } = ev;
        const deltaStamp = props.timeStamp - (this._keyStates[code]?.timeStamp ?? 0);

        this._keyStates[code] = { state: 0, timeStamp: props.timeStamp };
        this.emit('key_up', { ...props, code, key });
        this.emit(`${code.toLowerCase()}_up`, props);

        if (deltaStamp < this.inputThreshold) {
            this.emit('key_pressed', { ...props, code, key });
            this.emit(`${code.toLowerCase()}_pressed`, props);
        }
    }

    private _onMouseButtonDown(ev: MouseEvent) {
        const props = this._getCommonEventProps(ev);

        const { button } = ev;

        if (!this._mouseButtonStates[button]?.state) {
            this._mouseButtonStates[button] = { state: 1, timeStamp: props.timeStamp };
            this.emit('mouse_button_down', { ...props, button });
            this.emit(`mouse_button_${button}_down`, props);
        }
    }

    private _onMouseButtonUp(ev: MouseEvent) {
        const props = this._getCommonEventProps(ev);

        const { button } = ev;
        const deltaStamp = props.timeStamp - (this._mouseButtonStates[button]?.timeStamp ?? 0);

        this._mouseButtonStates[button] = { state: 0, timeStamp: props.timeStamp };
        this.emit('mouse_button_up', { ...props, button });
        this.emit(`mouse_button_${button}_up`, props);

        if (deltaStamp < this.inputThreshold) {
            this.emit('mouse_button_clicked', { ...props, button });
            this.emit(`mouse_button_${button}_clicked`, props);
        }
    }

    private _onMouseMove(ev: MouseEvent) {
        const props = this._getCommonEventProps(ev);

        const { buttons, offsetX, offsetY, movementX, movementY } = ev;

        this._mousePosition = [offsetX, offsetY];

        const width = window.innerWidth;
        const height = window.innerHeight;

        this._mousePosition2 = [
            (ev.clientX / width) * 2 - 1,
            -(ev.clientY / height) * 2 + 1,
        ];

        this.emit('mouse_move', {
            ...props,
            buttons,
            x: offsetX,
            y: offsetY,
            deltaX: movementX,
            deltaY: movementY,
        });
    }

    private _onWheel(ev: WheelEvent) {
        const props = this._getCommonEventProps(ev);
        const { deltaX, deltaY, deltaZ } = ev;

        this.emit('mouse_wheel', {
            ...props,
            deltaX, deltaY, deltaZ,
        });
    }

    /** Whether `keyCode` (a `KeyboardEvent.code`, e.g. `'Space'`) is currently held down. */
    public isKeyDown(keyCode: string): boolean {
        return this._keyStates[keyCode]?.state === 1 ? true : false;
    }

    /** Raw state (`1` down, `0` up, defaulting to `0` if never seen) for `keyCode`. */
    public getKeyState(keyCode: string): number {
        return this._keyStates[keyCode]?.state ?? 0;
    }

    /** Whether the given mouse button index is currently held down. */
    public isMouseButtonDown(mouseButton: number): boolean {
        return this._mouseButtonStates[mouseButton]?.state === 1 ? true : false;
    }

    /** Raw state (`1` down, `0` up) for the given mouse button index. */
    public getMouseButtonState(button: number): number {
        return this._mouseButtonStates[button]?.state ?? 0;
    }
}
