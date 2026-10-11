import { Observable } from "./observable";

/**
 * @typeParam TReceive data the worker posts back (the type of `onMessage` events' `data`)
 * @typeParam TSend data posted to the worker with `postMessage`
 */
export class WorkerInterface<TReceive = any, TSend = any> {
    private _worker: Worker;

    readonly onError = new Observable<ErrorEvent>();
    readonly onMessage = new Observable<MessageEvent<TReceive>>();

    constructor(url: string | URL) {
        this._worker = new Worker(url, { type: 'module' });

        this._worker.onerror = (error: ErrorEvent) => this.onError.notify(error);
        this._worker.onmessage = (message: MessageEvent<TReceive>) => this.onMessage.notify(message);
    }

    postMessage(message: TSend, options?: StructuredSerializeOptions | undefined) {
        this._worker.postMessage(message, options);
    }

    terminate() {
        this._worker.terminate();
    }
}
