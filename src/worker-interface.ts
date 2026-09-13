import { Observable } from "./observable";

export class WorkerInterface {
    private _worker: Worker;

    readonly onError = new Observable();
    readonly onMessage = new Observable();

    constructor(url: string | URL) {
        this._worker = new Worker(url, { type: 'module' });

        this._worker.onerror = (error: ErrorEvent) => this.onError.notify(error);
        this._worker.onmessage = (message: MessageEvent) => this.onMessage.notify(message);
    }

    postMessage(message: any, options?: StructuredSerializeOptions | undefined) {
        this._worker.postMessage(message, options);
    }

    terminate() {
        this._worker.terminate();
    }
}
