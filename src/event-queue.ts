/**
 * A buffered queue of events: producers `emit()` events, and a consumer reads them later (e.g.
 * once per frame) with `drain()`, or with `consume()` followed by `clear()`.
 *
 * ```ts
 * const collisions = new EventQueue<{ a: number, b: number }>();
 *
 * collisions.emit({ a: 1, b: 2 });               // physics system
 *
 * for (const { a, b } of collisions.drain()) { }  // gameplay system; the queue is now empty
 * ```
 *
 * @category Events & Timing
 */
export class EventQueue<T> {
    private readonly events: T[] = [];

    /** Appends an event to the queue. */
    emit(event: T): void {
        this.events.push(event);
    }

    /** Returns a copy of the queued events, oldest first, without removing them. */
    consume(): T[] {
        return this.events.slice();
    }

    /** Removes all queued events. */
    clear(): void {
        this.events.length = 0;
    }

    /** Removes and returns all queued events, oldest first. */
    drain(): T[] {
        return this.events.splice(0);
    }

    /** number of queued events */
    get size(): number {
        return this.events.length;
    }
}
