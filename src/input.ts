import { Emitter } from './emitter';
import { vec2 } from 'gl-matrix';

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
}

export class Input extends Emitter {
    public inputThreshold: number = 200;
    private _keyStates: { [key: string]: InputState } = {};
    private _mouseButtonStates: { [key: number]: InputState } = {};

    private _mousePosition: vec2 = vec2.create();
    private _mousePosition2: vec2 = vec2.create();

    public get mousePosition(): vec2 { return this._mousePosition; }
    public get mousePosition2(): vec2 { return this._mousePosition2; }

    constructor() {
        super();

        // this._parent.addEventListener('contextmenu', this._onContextMenu.bind(this));
        window.addEventListener('keydown', this._onKeyDown.bind(this) as EventListener);
        window.addEventListener('keyup', this._onKeyUp.bind(this) as EventListener);
        window.addEventListener('mousedown', this._onMouseButtonDown.bind(this) as EventListener);
        window.addEventListener('mouseup', this._onMouseButtonUp.bind(this) as EventListener);
        window.addEventListener('mousemove', this._onMouseMove.bind(this) as EventListener);
        window.addEventListener('wheel', this._onWheel.bind(this) as EventListener);
    }

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

        this._mousePosition = vec2.fromValues(offsetX, offsetY);

        const width = window.innerWidth;
        const height = window.innerHeight;

        this._mousePosition2 = vec2.fromValues(
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
