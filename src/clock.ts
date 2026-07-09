import { Emitter } from "./emitter";

export class Clock extends Emitter {
    private _startTime: number = 0;
    private _time: number = 0;
    private _deltaTime: number = 0;
    private _frameTime: number = 0;
    private _frameCount: number = 0;
    private _fps: number = 0;
    private _isRunning: boolean = false;

    get time(): number { return this._time; }
    get deltaTime(): number { return this._deltaTime; }
    get elapsedTime(): number { return performance.now() - this._startTime; }
    get fps(): number { return this._fps; }
    get isRunning(): boolean { return this._isRunning; }

    public start(): this {
        if (!this._isRunning) {
            this._startTime = performance.now();
            this._isRunning = true;

            const update = (time: DOMHighResTimeStamp) => {
                this._deltaTime = (time - this._time) / 1000;
                this._time = time;

                if (this._frameTime + 1000 >= time) {
                    this._frameCount += 1;
                } else {
                    this._frameTime = time;
                    this._fps = this._frameCount;
                    this._frameCount = 0;
                }

                this.emit('frame', this._deltaTime);

                if (this._isRunning) {
                    requestAnimationFrame(update);
                }
            };

            requestAnimationFrame(update);
        }

        return this;
    }

    public stop() {
        this._isRunning = false;
    }
}
