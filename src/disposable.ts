/* Example:
const subscriptions = new Disposable();

subscriptions.add(player.health.subscribe(updateHealthBar));
subscriptions.add(window.onResize.subscribe(layoutUi));
subscriptions.add(texture.onLoaded.subscribe(uploadToGpu));

// Later...
subscriptions.dispose();
*/

/**
 * Collects cleanup functions (e.g. the unsubscribe functions returned by {@link Observable.subscribe}
 * and {@link Signal.subscribe}) and runs them all at once.
 *
 * ```ts
 * const subscriptions = new Disposable();
 *
 * subscriptions.add(health.subscribe(updateHealthBar));
 * subscriptions.add(onLoaded.subscribe(uploadToGpu));
 *
 * subscriptions.dispose(); // later
 * ```
 *
 * @category Events & Timing
 */
export class Disposable {
    private readonly disposers: (() => void)[] = [];

    /** Adds a cleanup function to run on {@link Disposable.dispose}. */
    add(disposer: () => void): void {
        this.disposers.push(disposer);
    }

    /**
     * Runs and removes every cleanup function, in reverse order of adding. The instance can be
     * reused afterwards.
     */
    dispose(): void {
        while (this.disposers.length) {
            this.disposers.pop()?.();
        }
    }
}
