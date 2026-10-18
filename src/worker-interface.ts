import { Observable } from "./observable";

/**
 * Thin wrapper around a module `Worker` that exposes its errors and messages as
 * {@link Observable}s.
 *
 * ```ts
 * const worker = new WorkerInterface<Result, Job>(new URL('./worker.ts', import.meta.url));
 * worker.onMessage.subscribe((event) => console.log(event.data));
 * worker.postMessage(job);
 * ```
 *
 * @typeParam TReceive data the worker posts back (the type of `onMessage` events' `data`)
 * @typeParam TSend data posted to the worker with `postMessage`
 * @category Utilities
 */
export class WorkerInterface<TReceive = any, TSend = any> {
    private _worker: Worker;

    /** notified with the worker's `error` events */
    readonly onError = new Observable<ErrorEvent>();
    /** notified with every message the worker posts back */
    readonly onMessage = new Observable<MessageEvent<TReceive>>();

    /** Starts a module worker (`{ type: 'module' }`) from `url`. */
    constructor(url: string | URL) {
        this._worker = new Worker(url, { type: 'module' });

        this._worker.onerror = (error: ErrorEvent) => this.onError.notify(error);
        this._worker.onmessage = (message: MessageEvent<TReceive>) => this.onMessage.notify(message);
    }

    /** Sends `message` to the worker (structured-cloned; `options.transfer` lists objects to transfer). */
    postMessage(message: TSend, options?: StructuredSerializeOptions | undefined) {
        this._worker.postMessage(message, options);
    }

    /** Stops the worker immediately. */
    terminate() {
        this._worker.terminate();
    }
}
