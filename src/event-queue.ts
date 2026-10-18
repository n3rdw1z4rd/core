/* Example:
interface CollisionEvent {
    a: Entity;
    b: Entity;
}

const collisions = new EventQueue<CollisionEvent>();

// Physics system
collisions.emit({
    a,
    b
});

// Gameplay system
for (const collision of collisions.drain()) {

}
*/

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

    /**
     * Returns the queued events without removing them. This is the live internal array, not a
     * copy: it changes with later `emit()` / `clear()` / `drain()` calls.
     */
    consume(): readonly T[] {
        return this.events;
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
