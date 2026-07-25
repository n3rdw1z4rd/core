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

export class EventQueue<T> {
    private readonly events: T[] = [];

    emit(event: T): void {
        this.events.push(event);
    }

    consume(): readonly T[] {
        return this.events;
    }

    clear(): void {
        this.events.length = 0;
    }

    drain(): T[] {
        return this.events.splice(0);
    }

    get size(): number {
        return this.events.length;
    }
}
