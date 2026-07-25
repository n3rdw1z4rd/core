type Observer<T> = (value: T, ...args: any[]) => void;

/* Example:
class Texture {
    readonly onLoaded = new Observable<Texture>();

    load() {
        // ...
        this.onLoaded.notify(this, arg1, arg2, ...);
    }
}

texture.onLoaded.subscribe(texture => {
    console.log(texture);
});
*/

export class Observable<T> {
    private readonly observers = new Set<Observer<T>>();

    subscribe(observer: Observer<T>): () => void {
        this.observers.add(observer);
        return () => this.observers.delete(observer);
    }

    once(observer: Observer<T>, ...args: any[]): () => void {
        const unsubscribe = this.subscribe(value => {
            unsubscribe();
            observer(value, ...args);
        });

        return unsubscribe;
    }

    notify(value: T, ...args: any[]): void {
        for (const observer of [...this.observers]) {
            observer(value, ...args);
        }
    }

    clear(): void {
        this.observers.clear();
    }

    get size(): number {
        return this.observers.size;
    }
}
