import { ClockStats } from './clock-stats';

/**
 * Frame-loop driver built on `requestAnimationFrame`. Tracks delta time,
 * FPS, and total frame count, and can optionally render a small on-screen
 * stats overlay via {@link showStats} / {@link ClockStats}.
 */
export class Clock {
    private _lastFrameTime: number = 0;
    private _daltaTimeMilliseconds: number = 0;
    private _deltaTimeSeconds: number = 0;
    private _avgDeltaTime: number = 0;
    private _frameCount: number = 0;
    private _frameCountTotal: number = 0;
    private _frameTime: number = 0;
    private _fps: number = 0;
    private _isRunning: boolean = false;
    private _updateCallback: (deltaTime: number) => void = () => { };
    private _statsParent: HTMLElement | undefined;
    private _stats: ClockStats | undefined;
    private _startTime: number = 0;

    /** Frames rendered in the last full second (updates once per second, not every frame). */
    get fps(): number { return this._fps; }
    /** Total frames rendered since {@link run} was last started. */
    get frames(): number { return this._frameCountTotal; }
    /** Time since the previous frame, in seconds. */
    get deltaTimeSeconds(): number { return this._deltaTimeSeconds; }
    /** Time since the previous frame, in milliseconds. */
    get deltaTimeMilliseconds(): number { return this._daltaTimeMilliseconds; }
    /** Rolling average frame time in milliseconds over the current one-second FPS window. */
    get avgDeltaTime(): number { return this._avgDeltaTime; }
    /** Timestamp (`performance.now()`-scale) of the most recent frame. */
    get time(): number { return this._lastFrameTime; }
    /** Whether {@link run} has been started and not yet {@link stop}ped. */
    get isRunning(): boolean { return this._isRunning; }
    /** Milliseconds elapsed since {@link run} was last started. */
    get elapsedTimeSinceStart(): number { return performance.now() - this._startTime; }

    constructor(statsDivParent?: HTMLElement) {
        this._statsParent = statsDivParent;
    }

    private _update(time: number) {
        this.update(time);

        this._updateCallback(this._deltaTimeSeconds);

        if (this._isRunning) {
            requestAnimationFrame(this._update.bind(this));
        }
    }

    /** Advances the clock to `time` (a `performance.now()`-scale timestamp), recomputing delta time and FPS. Normally called internally by {@link run}. */
    public update(time: number) {
        this._daltaTimeMilliseconds = time - this._lastFrameTime;
        this._deltaTimeSeconds = this._daltaTimeMilliseconds / 1000;
        this._lastFrameTime = time;

        if (this._frameTime + 1000 >= time) {
            this._frameCount += 1;
        } else {
            this._frameTime = time;
            this._fps = this._frameCount;
            this._frameCount = 0;
        }

        this._frameCountTotal++;

        this._avgDeltaTime = (this._avgDeltaTime * this._frameCount + this._daltaTimeMilliseconds) / (this._frameCount + 1);
    }

    /** Starts the `requestAnimationFrame` loop, invoking `callback(deltaTimeSeconds)` every frame until {@link stop} is called. */
    public run(callback: (deltaTime: number) => void) {
        if (!this._isRunning) {
            this._frameCountTotal = 0;
            this._startTime = performance.now();
            this._isRunning = true;
            this._updateCallback = callback;
            requestAnimationFrame(this._update.bind(this));
        }
    }

    /** Runs a single frame immediately (time `0`) without starting the animation loop. */
    public runOnce(callback: (deltaTime: number) => void) {
        this._isRunning = false;
        this._updateCallback = callback;
        this._update(0);
    }

    /** Stops the animation loop started by {@link run}. */
    public stop() {
        this._isRunning = false;
    }

    /** Runs `func` and returns how long it took, in milliseconds. */
    public getExecuteTime(func: () => void): number {
        const now: number = performance.now();
        func();
        return performance.now() - now;
    }

    /** Renders (creating on first call) a small on-screen overlay showing FPS/delta-time plus any extra `data`. */
    public showStats(data: object = {}, parent?: HTMLElement) {
        parent = (parent ?? this._statsParent ?? document.body);

        if (!this._stats) {
            this._stats = new ClockStats();
            this._stats.appendTo(parent);
        }

        this._stats.update({
            fps: this._fps,
            'deltaTime(s)': `${this._deltaTimeSeconds.toFixed(3)}`,
            'avgDeltaTime(ms)': `${this._avgDeltaTime.toFixed(3)}`,
            ...data,
        });
    }
}