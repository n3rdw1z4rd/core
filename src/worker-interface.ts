import { Emitter } from './emitter';

export class WorkerInterface extends Emitter {
    private _worker: Worker;

    constructor(url: string | URL) {
        super();

        this._worker = new Worker(url, { type: 'module' });
        this._worker.onerror = (error: ErrorEvent) => this.emit('error', error);
        this._worker.onmessage = (message: MessageEvent) => this.emit('message', message);
    }

    postMessage(message: any, options?: StructuredSerializeOptions | undefined) {
        this._worker.postMessage(message, options);
    }

    terminate() {
        this._worker.terminate();
    }
}
