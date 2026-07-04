# Networking

`import { ... } from "@n3rdw1z4rd/core";`

## WorkerInterface

A thin wrapper around `Worker` that gives you an [`Emitter`](events.md)-based (`'message'`, `'error'`) event surface instead of raw `onmessage`/`onerror` assignment - handy for treating a worker like just another event source alongside everything else built on `Emitter` in this package (`Input`, etc.).

```ts
class WorkerInterface extends Emitter {
    constructor(url: string | URL);
    postMessage(message: any, options?: StructuredSerializeOptions): void;
    terminate(): void;
}
```

```ts
import { WorkerInterface, log, logerr } from "@n3rdw1z4rd/core";

const worker = new WorkerInterface(new URL('./physics-worker.ts', import.meta.url));

worker.on('message', (event: MessageEvent) => {
    log('from worker:', event.data);
});

worker.on('error', (error: ErrorEvent) => {
    logerr('worker error:', error);
});

worker.postMessage({ type: 'init' });
```

**Pass an already-resolved `URL`, not a bare path string.** Construct it as `new URL('./my-worker.ts', import.meta.url)` in *your own* module before passing it in - resolving `import.meta.url` inside `WorkerInterface` itself would resolve relative to this package's own location once bundled into `node_modules`, not relative to your worker file.

Workers are always created with `{ type: 'module' }` (no classic-script worker support) - your worker entry file needs to use ES module syntax (`import`/`export`), which is what Vite, and most modern bundlers, expect anyway.
