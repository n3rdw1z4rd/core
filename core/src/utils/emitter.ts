export class Emitter {
    private listeners: any = {};

    on(events: Array<string> | string, callback: Function) {
        if (!Array.isArray(events)) {
            events = [events];
        }

        events.forEach((event) => {
            if (this.listeners[event] === undefined) {
                this.listeners[event] = [callback];
            } else {
                this.listeners[event].push(callback);
            }
        });
    }

    emit(event: string, ...args: any) {
        this.listeners[event]?.forEach((callback: Function) => callback(...args));
    }
}
