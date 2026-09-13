import { Emitter } from "./emitter";
import { Vector } from "./vector";

export interface InputState {
    state: number,
    timeStamp: number,
}

export interface CommonEventProps {
    timeStamp: number,
    altKey: boolean,
    ctrlKey: boolean,
    metaKey: boolean,
    shiftKey: boolean,
    event: KeyboardEvent | MouseEvent | PointerEvent | WheelEvent,
}

export class Input extends Emitter {
    private static _instance: Input;

    public static get instance(): Input {
        if (!Input._instance) {
            Input._instance = new Input();
        }

        return Input._instance;
    }

    private _keyStates: { [key: string]: InputState } = {};
    private _mouseButtonStates: { [key: number]: InputState } = {};

    private _mousePosition = new Vector();
    private _mousePosition2 = new Vector();

    public get mousePosition(): Vector { return this._mousePosition; }
    public get mousePosition2(): Vector { return this._mousePosition2; }

    public inputThreshold: number = 200;

    private constructor() {
        super();

        // this._parent.addEventListener('contextmenu', this._onContextMenu.bind(this));
        window.addEventListener('keydown', this._onKeyDown.bind(this) as EventListener);
        window.addEventListener('keyup', this._onKeyUp.bind(this) as EventListener);
        window.addEventListener('pointerdown', this._onPointerButtonDown.bind(this) as EventListener);
        window.addEventListener('pointerup', this._onPointerButtonUp.bind(this) as EventListener);
        window.addEventListener('mousemove', this._onMouseMove.bind(this) as EventListener);
        window.addEventListener('wheel', this._onWheel.bind(this) as EventListener);
    }

    private _getCommonEventProps(event: KeyboardEvent | MouseEvent | PointerEvent | WheelEvent): CommonEventProps {
        const props: CommonEventProps = {
            timeStamp: event.timeStamp,
            altKey: event.altKey,
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
            shiftKey: event.shiftKey,
            event,
        };

        return props;
    }

    // private _onContextMenu(ev: MouseEvent) {
    //     ev.preventDefault();
    //     this.emit('contextmenu');
    //     return false;
    // }

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

    private _onPointerButtonDown(ev: PointerEvent) {
        const props = this._getCommonEventProps(ev);

        const { button } = ev;

        if (!this._mouseButtonStates[button]?.state) {
            this._mouseButtonStates[button] = { state: 1, timeStamp: props.timeStamp };

            switch (ev.pointerType) {
                case 'touch':
                    this.emit('touch_down', { ...props, button });
                    break;
                default:
                    this.emit('mouse_button_down', { ...props, button });
                    this.emit(`mouse_button${button}_down`, props);
                    break;
            }
        }
    }

    private _onPointerButtonUp(ev: PointerEvent) {
        const props = this._getCommonEventProps(ev);

        const { button } = ev;
        const deltaStamp = props.timeStamp - (this._mouseButtonStates[button]?.timeStamp ?? 0);

        this._mouseButtonStates[button] = { state: 0, timeStamp: props.timeStamp };

        switch (ev.pointerType) {
            case 'touch':
                this.emit('touch_up', { ...props, button });
                break;
            default:
                this.emit('mouse_button_up', { ...props, button });
                this.emit(`mouse_button${button}_up`, props);
                break;
        }

        if (deltaStamp < this.inputThreshold) {
            switch (ev.pointerType) {
                case 'touch':
                    this.emit('tapped', { ...props, button });
                    break;
                default:
                    this.emit('mouse_button_clicked', { ...props, button });
                    this.emit(`mouse_button${button}_clicked`, props);
                    break;
            }
        }
    }

    private _onMouseMove(ev: MouseEvent) {
        const props = this._getCommonEventProps(ev);

        const { buttons, offsetX, offsetY, movementX, movementY } = ev;

        this._mousePosition = new Vector(offsetX, offsetY);

        const width = window.innerWidth;
        const height = window.innerHeight;

        this._mousePosition2 = new Vector(
            (ev.clientX / width) * 2 - 1,
            -(ev.clientY / height) * 2 + 1,
        );

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

    public isKeyDown(keyCode: string): boolean {
        return this._keyStates[keyCode]?.state === 1 ? true : false;
    }

    public getKeyState(keyCode: string): number {
        return this._keyStates[keyCode]?.state ?? 0;
    }

    public isMouseButtonDown(mouseButton: number): boolean {
        return this._mouseButtonStates[mouseButton]?.state === 1 ? true : false;
    }

    public getMouseButtonState(button: number): number {
        return this._mouseButtonStates[button]?.state ?? 0;
    }
}
