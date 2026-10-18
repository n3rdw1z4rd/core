/**
 * An {@link Emitter} listener: called with the emitted arguments, followed by the event name.
 *
 * @category Events & Timing
 */
export type Listener = (...args: any[]) => void;

/**
 * A string-keyed event emitter. There is no way to remove a listener.
 *
 * ```ts
 * const events = new Emitter();
 *
 * events.on('hit', 'miss', (target, eventName) => console.log(eventName, target));
 * events.emit('hit', enemy); // logs 'hit', enemy
 * ```
 *
 * @category Events & Timing
 */
export class Emitter {
    private listeners: Map<string, Listener[]> = new Map<string, Listener[]>();

    constructor() { }

    /**
     * Adds a listener (the last argument) to one or more event names (the arguments before it).
     * Adding the same listener twice makes it fire twice. Returns `this` for chaining.
     */
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

    /**
     * Calls the listeners of `eventName` in the order they were added, with `args` followed by
     * `eventName`. Returns `this` for chaining.
     */
    public emit(eventName: string, ...args: any[]): this {
        this.listeners.get(eventName)?.forEach((listener: Listener) => listener(...args, eventName));

        return this;
    }
}
