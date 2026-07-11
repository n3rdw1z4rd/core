import { Emitter } from "../emitter";
import { log } from "../log";
import { Vector } from "../math";

export interface InputEventState {
    state: number,
    time: number,
}

export class Input extends Emitter {
    private _down = new Map<string, InputEventState>();
    private _pointerPosition = new Vector();

    public inputThreshold: number = 200;

    public get down(): Map<string, InputEventState> { return this._down; }
    public get pointerPosition(): Vector { return this._pointerPosition; }

    constructor() {
        super();

        window.addEventListener('contextmenu', (ev: PointerEvent) => {
            log('contextmenu:', ev);
        });

        window.addEventListener('keydown', (ev: KeyboardEvent) => {
            const { code, repeat, timeStamp } = ev;

            if (!repeat) {
                this._down.set(code, { state: 1, time: timeStamp });
                this.emit('key_down', code, ev);
            }
        });

        window.addEventListener('keyup', (ev: KeyboardEvent) => {
            const { code, timeStamp } = ev;
            const delta = timeStamp - (this._down.get(code)?.time ?? 0);

            this._down.set(code, { state: 0, time: timeStamp });
            this.emit('key_up', code, ev);

            if (delta < this.inputThreshold) {
                this.emit('key_pressed', code, ev);
            }
        });

        window.addEventListener('pointerdown', (ev: PointerEvent) => {
            const { button, timeStamp } = ev;
            const code = `Button${button}`;

            if (!this._down.get(code)) {
                this._down.set(code, { state: 1, time: timeStamp });
                this.emit('pointer_down', code, ev);
            }
        });

        window.addEventListener('pointerup', (ev: PointerEvent) => {
            const { button, timeStamp } = ev;
            const code = `Button${button}`;
            const delta = timeStamp - (this._down.get(code)?.time ?? 0);

            this._down.set(code, { state: 0, time: timeStamp });

            if (delta < this.inputThreshold) {
                this.emit('button_clicked', code, ev);
            }
        });

        window.addEventListener('mousemove', (ev: MouseEvent) => {
            const { offsetX, offsetY, movementX, movementY } = ev;

            this._pointerPosition.x = offsetX;
            this._pointerPosition.y = offsetY;

            this.emit('pointer_move', movementX, movementY, ev);
        });

        window.addEventListener('wheel', (ev: WheelEvent) => {
            const { deltaY } = ev;

            // this.emit('wheel', deltaY > 0 ? 1 : -1, ev);
            this.emit('wheel', deltaY, ev);
        });
    }

    isDown(name: string): boolean {
        return this._down.get(name) ? true : false;
    }
}