/** Callback registered on an {@link Emitter}; receives the emitted args followed by the event name. */
export type Listener = (...args: any[]) => void;

/**
 * Minimal string-keyed event emitter. Unlike {@link EventBus}, this isn't
 * built on `EventTarget` - just a plain `Map` of listener arrays - so it
 * works outside browser-only contexts too.
 */
export class Emitter {
    private listeners: Map<string, Listener[]> = new Map<string, Listener[]>();

    constructor() { }

    /** Registers `listener` for one or more event names (last argument is always the listener). */
    public on<T extends string[]>(...eventName: [...T, Listener]): this {
        const listener = eventName.pop() as Listener;
        const events: string[] = eventName.filter((ev: any) => (typeof ev === 'string')) as string[];

        events.forEach((event: string) => {
            if (!this.listeners.has(event)) {
                this.listeners.set(event, new Array<Listener>());
            }

            this.listeners.get(event)?.push(listener);
        });

        return this;
    }

    /** Synchronously invokes every listener registered for `eventName`, passing `args` plus the event name. */
    public emit(eventName: string, ...args: any[]): this {
        this.listeners.get(eventName)?.forEach((listener: Listener) => listener(...args, eventName));

        return this;
    }

    /** Removes all listeners for `eventName`, or every listener for every event if omitted. */
    public clear(eventName?: string): this {
        if (eventName) {
            this.listeners.delete(eventName);
        } else {
            this.listeners.clear();
        }

        return this;
    }
}

/** Default shared {@link Emitter} instance for app-wide events. */
export const GlobalEmitter = new Emitter();

/**
 * Thin `EventTarget` wrapper using `CustomEvent`/`detail` under the hood -
 * prefer this over {@link Emitter} when you want events to also be visible
 * to native DOM APIs (e.g. `addEventListener` from outside this package).
 */
export class EventBus extends EventTarget {
    /** Dispatches a `CustomEvent` of `type` with `detail` as its payload. */
    emit(type: string, detail?: any) {
        this.dispatchEvent(new CustomEvent(type, { detail }))
    }

    /** Registers `cb` for `type`, called with the underlying `CustomEvent` (so `e.detail` holds the payload). */
    on(type: string, cb: (e: CustomEvent) => void) {
        this.addEventListener(type, cb as EventListener)
    }
}

/** Default shared {@link EventBus} instance. */
export const eventBus = new EventBus()
