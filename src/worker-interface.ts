import { Emitter } from './emitter';

/**
 * Generic wrapper around a `Worker`: gives you an {@link Emitter}-based
 * (`'message'`, `'error'`) event surface instead of raw
 * `onmessage`/`onerror`.
 *
 * Pass an already-resolved URL (e.g. `new URL('./my-worker.ts',
 * import.meta.url)` computed in **your** module), not a bare path -
 * resolving `import.meta.url` here would resolve relative to this file's
 * location once bundled into `node_modules`, not relative to your worker
 * file.
 */
export class WorkerInterface extends Emitter {
    private _worker: Worker;

    constructor(url: string | URL) {
        super();

        this._worker = new Worker(url, { type: 'module' });
        this._worker.onerror = (error: ErrorEvent) => this.emit('error', error);
        this._worker.onmessage = (message: MessageEvent) => this.emit('message', message);
    }

    /** Sends `message` to the worker. See `Worker.postMessage`. */
    postMessage(message: any, options?: StructuredSerializeOptions | undefined) {
        this._worker.postMessage(message, options);
    }

    /** Immediately stops the worker. */
    terminate() {
        this._worker.terminate();
    }
}
