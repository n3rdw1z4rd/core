export const ONE_SECOND = 1000;

export type ClockCallback = (deltaTime: number, elapsedTime: number) => void;

/**
 * Frame timing: delta time, elapsed time and FPS.
 *
 * Either let the clock run the loop:
 *
 *     clock.start((dt) => { update(dt); render(); });
 *
 * or advance it from a loop something else drives (three.js, WebXR):
 *
 *     renderer.setAnimationLoop((time) => { const dt = clock.tick(time); ... });
 */
export class Clock {
    // seconds; caps the delta time after a stall or a hidden tab (browsers pause the frame loop
    // in background tabs, so the first frame back would otherwise cover the whole absence)
    maxDeltaTime: number = 0.1;

    private _callback?: ClockCallback;
    private _rafId: number = 0;
    private _isRunning: boolean = false;

    private _lastTime: number = -1; // ms; -1 until the first tick
    private _deltaTime: number = 0;
    private _elapsedTime: number = 0;

    private _fps: number = 0;
    private _fpsFrames: number = 0;
    private _fpsTime: number = 0;

    get deltaTime(): number { return this._deltaTime; }

    // seconds since start() (or the first tick), summed from the capped delta times,
    // so it stays in step with the simulation rather than wall-clock time
    get elapsedTime(): number { return this._elapsedTime; }

    get fps(): number { return this._fps; }
    get isRunning(): boolean { return this._isRunning; }

    /**
     * Advances the clock and returns the delta time in seconds. The first tick returns 0.
     *
     * @param time timestamp in milliseconds, e.g. from requestAnimationFrame or setAnimationLoop
     */
    tick(time: number = performance.now()): number {
        // first tick only starts the timing: no elapsed time yet, and it opens the fps window
        if (this._lastTime < 0) {
            this._lastTime = time;
            this._fpsTime = time;
            this._deltaTime = 0;

            return 0;
        }

        this._deltaTime = Math.min(Math.max(0, (time - this._lastTime) / ONE_SECOND), this.maxDeltaTime);
        this._elapsedTime += this._deltaTime;
        this._lastTime = time;

        this._fpsFrames++;

        if (time - this._fpsTime >= ONE_SECOND) {
            this._fps = Math.round(this._fpsFrames * ONE_SECOND / (time - this._fpsTime));
            this._fpsFrames = 0;
            this._fpsTime = time;
        }

        return this._deltaTime;
    }

    /**
     * Runs `callback` every animation frame with the delta and elapsed time in seconds.
     * Restarts timing from zero; calling it while running just swaps the callback.
     */
    start(callback: ClockCallback): void {
        this._callback = callback;

        if (this._isRunning) return;

        this._isRunning = true;
        this._reset();

        const frame = (time: DOMHighResTimeStamp) => {
            this.tick(time);
            this._callback?.(this._deltaTime, this._elapsedTime);

            if (this._isRunning) {
                this._rafId = requestAnimationFrame(frame);
            }
        };

        this._rafId = requestAnimationFrame(frame);
    }

    stop(): void {
        this._isRunning = false;
        cancelAnimationFrame(this._rafId);
    }

    private _reset(): void {
        this._lastTime = -1;
        this._deltaTime = 0;
        this._elapsedTime = 0;
        this._fps = 0;
        this._fpsFrames = 0;
    }
}
