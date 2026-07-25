import { Observable } from "./observable";
import { Vector } from "./vector";

export interface InputEventState {
    state: number,
    time: number,
}

export const DOWN = 1;
export const UP = 0;

export class Input {
    private static _instance: Input;

    static get instance(): Input {
        if (!Input._instance) {
            Input._instance = new Input();
        }

        return Input._instance;
    }

    private _keyStates: Map<string, InputEventState>;
    private _buttonStates: Map<string, InputEventState>;
    private _pointerPosition = new Vector();

    inputThreshold: number = 200;

    get pointerPosition(): Vector { return this._pointerPosition.clone(); }

    // get mouseWorldPosition(): Vector {
    //     return new Vector(
    //         (this._mousePosition.x / this.canvasWidth) * 2 - 1,
    //         -(this._mousePosition.y / this.canvasHeight) * 2 + 1,
    //     )
    // }

    readonly onKeyDown = new Observable<Input>();
    readonly onKeyUp = new Observable<Input>();
    readonly onKeyPressed = new Observable<Input>();

    readonly onPointerDown = new Observable<Input>();
    readonly onPointerUp = new Observable<Input>();
    readonly onPointerPressed = new Observable<Input>();
    readonly onPointerMove = new Observable<Input>();

    readonly onWheel = new Observable<Input>();

    private constructor() {
        this._keyStates = new Map();
        this._buttonStates = new Map();

        // this._parent.addEventListener('contextmenu', this._onContextMenu.bind(this));

        window.addEventListener('keydown', (ev: KeyboardEvent) => {
            if (!ev.repeat) {
                this._keyStates.set(ev.code, { state: DOWN, time: ev.timeStamp });
                this.onKeyDown.notify(this, ev)
            }
        });

        window.addEventListener('keyup', (ev: KeyboardEvent) => {
            this._keyStates.set(ev.code, { state: UP, time: ev.timeStamp });
            this.onKeyUp.notify(this, ev);

            const delta = ev.timeStamp - (this._keyStates.get(ev.code)?.time ?? 0);

            if (delta < this.inputThreshold) {
                this.onKeyPressed.notify(this, ev);
            }
        });

        window.addEventListener('pointerdown', (ev: PointerEvent) => {
            const code = `Button${ev.button}`;

            if (!this._buttonStates.get(code)) {
                this._buttonStates.set(code, { state: DOWN, time: ev.timeStamp });
                this.onPointerDown.notify(this, ev);
            }
        });

        window.addEventListener('pointerup', (ev: PointerEvent) => {
            const code = `Button${ev.button}`;

            this._buttonStates.set(code, { state: UP, time: ev.timeStamp });
            this.onPointerUp.notify(this, ev);

            const delta = ev.timeStamp - (this._buttonStates.get(code)?.time ?? 0);

            if (delta < this.inputThreshold) {
                this.onPointerPressed.notify(this, ev);
            }
        });

        window.addEventListener('pointermove', (ev: MouseEvent) => {
            this._pointerPosition.x = ev.offsetX;
            this._pointerPosition.y = ev.offsetY;

            this.onPointerMove.notify(this, ev);
        });

        window.addEventListener('wheel', (ev: WheelEvent) => {
            this.onWheel.notify(this, ev);
        });
    }

    isDown(key: string): boolean {
        return (this._keyStates.get(key) ?? this._buttonStates.get(key))?.state === 1;
    }
}
