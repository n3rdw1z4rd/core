/* Example:
const subscriptions = new Disposable();

subscriptions.add(player.health.subscribe(updateHealthBar));
subscriptions.add(window.onResize.subscribe(layoutUi));
subscriptions.add(texture.onLoaded.subscribe(uploadToGpu));

// Later...
subscriptions.dispose();
*/

export class Disposable {
    private readonly disposers: (() => void)[] = [];

    add(disposer: () => void): void {
        this.disposers.push(disposer);
    }

    dispose(): void {
        while (this.disposers.length) {
            this.disposers.pop()?.();
        }
    }
}
