/**
 * An {@link Observable} observer: called with the notified value (and any extra arguments).
 *
 * @category Events & Timing
 */
export type Observer<T> = (value: T, ...args: any[]) => void;

/**
 * A set of observers notified with a value (plus optional extra arguments). Observers are
 * called in subscription order; subscribing the same function twice has no effect.
 *
 * ```ts
 * const onLoaded = new Observable<string>();
 * const unsubscribe = onLoaded.subscribe(url => console.log('loaded', url));
 *
 * onLoaded.notify('a.png');
 * unsubscribe();
 * ```
 *
 * @category Events & Timing
 */
export class Observable<T> {
    private readonly observers = new Set<Observer<T>>();

    /** Adds an observer; returns a function that removes it. */
    subscribe(observer: Observer<T>): () => void {
        this.observers.add(observer);
        return () => this.observers.delete(observer);
    }

    /**
     * Subscribes for the next notification only; the observer gets the same arguments as with
     * {@link Observable.subscribe}.
     *
     * @returns a function that removes the observer before it fires
     */
    once(observer: Observer<T>): () => void {
        const unsubscribe = this.subscribe((value, ...args) => {
            unsubscribe();
            observer(value, ...args);
        });

        return unsubscribe;
    }

    /**
     * Calls every observer with `value` and `args`. Iterates over a snapshot, so observers may
     * subscribe or unsubscribe during the call.
     */
    notify(value: T, ...args: any[]): void {
        for (const observer of [...this.observers]) {
            observer(value, ...args);
        }
    }

    /** Removes all observers. */
    clear(): void {
        this.observers.clear();
    }

    /** number of observers */
    get size(): number {
        return this.observers.size;
    }
}
