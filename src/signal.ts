/**
 * A {@link Signal} subscriber: called with the new value.
 *
 * @category Events & Timing
 */
export type Subscriber<T> = (value: T) => void;

/**
 * A value holder that notifies subscribers when the value changes (compared with `Object.is`).
 * Subscribers are called immediately with the current value when they subscribe.
 *
 * ```ts
 * const health = new Signal(100);
 * const unsubscribe = health.subscribe(value => console.log(value)); // logs 100
 *
 * health.set(80);  // logs 80
 * health.set(80);  // unchanged: nothing logged
 * unsubscribe();
 * ```
 *
 * @category Events & Timing
 */
export class Signal<T> {
    private value: T;
    private readonly subscribers = new Set<Subscriber<T>>();

    constructor(initialValue: T) {
        this.value = initialValue;
    }

    /** Returns the current value. */
    get(): T {
        return this.value;
    }

    /** Sets the value and notifies subscribers; does nothing if it is the same (`Object.is`). */
    set(value: T): void {
        if (Object.is(this.value, value)) return;

        this.value = value;

        for (const subscriber of [...this.subscribers]) {
            subscriber(value);
        }
    }

    /** Adds a subscriber and calls it right away with the current value; returns a function that removes it. */
    subscribe(subscriber: Subscriber<T>): () => void {
        this.subscribers.add(subscriber);

        subscriber(this.value); // immediately notify

        return () => this.subscribers.delete(subscriber);
    }
}
