# Events

`import { ... } from "@n3rdw1z4rd/core";`

## Emitter

A minimal typed event emitter. Most classes in this package (`Input`, `PhysicsWorld`-style clients, `WorkerInterface`) extend it rather than rolling their own pub/sub.

```ts
class Emitter {
    on(...eventNames: string[], listener: (...args: any[]) => void): this;
    emit(eventName: string, ...args: any[]): this;
    clear(eventName?: string): this; // clears one event's listeners, or all of them
}

const GlobalEmitter: Emitter; // a ready-to-use shared instance
```

`on()` accepts multiple event names before the listener, so you can register one callback for several events at once:

```ts
import { Emitter, log } from "@n3rdw1z4rd/core";

class Foo extends Emitter { }

const foo = new Foo();

foo.on('start', 'stop', (eventName) => log('fired:', eventName));
foo.emit('start'); // logs "fired: start"
```

Every listener also receives the event name as its last argument (see `emit`'s implementation) - handy when one function is subscribed to multiple events and needs to branch.

## EventBus

A separate, simpler pub/sub built directly on the DOM's `EventTarget`/`CustomEvent`, for cases where you want a shared bus without threading an `Emitter` instance through your code.

```ts
class EventBus extends EventTarget {
    emit(type: string, detail?: any): void;
    on(type: string, cb: (e: CustomEvent) => void): void;
}

const eventBus: EventBus; // a ready-to-use shared instance
```

```ts
import { eventBus, log } from "@n3rdw1z4rd/core";

eventBus.on('score-changed', (e) => log(e.detail));
eventBus.emit('score-changed', { score: 42 });
```
