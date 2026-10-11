import { Observable } from "./observable";

export const ONE_SECOND = 1000;

export class Clock {
    private _fps: number = 0;
    private _frameCount: number = 0;
    private _frameTime: number = 0;
    private _isRunning: boolean = false;
    private _lastTime: number = -1;

    readonly onFpsUpdate = new Observable<number>();
    readonly onFrame = new Observable<number>();

    readonly startTime = performance.now();

    get elapsedTime(): number { return performance.now() - this.startTime; }
    get fps(): number { return this._fps; }
    get isRunning(): boolean { return this._isRunning; }

    private _rafId: number = 0;

    update(time: number): number {
        // first frame (or first after start()): no previous timestamp, so no elapsed time
        if (this._lastTime < 0) {
            this._lastTime = time;
            this._frameTime = time;
        }

        const deltaTime = (time - this._lastTime) / ONE_SECOND;

        this._lastTime = time;
        this._frameCount++;

        if (time - this._frameTime >= ONE_SECOND) {
            this._fps = Math.round(this._frameCount * ONE_SECOND / (time - this._frameTime));
            this._frameTime = time;
            this._frameCount = 0;

            this.onFpsUpdate.notify(this.fps);
        }

        return deltaTime;
    }

    start() {
        if (!this._isRunning) {
            const animate = (time: DOMHighResTimeStamp) => {
                if (!this._isRunning) return;

                this.onFrame.notify(this.update(time));

                if (this._isRunning)
                    this._rafId = requestAnimationFrame(animate);
            };

            this._isRunning = true;
            this._lastTime = -1;
            this._frameCount = 0;
            this._rafId = requestAnimationFrame(animate);
        }
    }

    stop() {
        this._isRunning = false;
        cancelAnimationFrame(this._rafId);
    }
}
