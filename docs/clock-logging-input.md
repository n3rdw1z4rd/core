# Clock, Logging & Input

`import { ... } from '@n3rdw1z4rd/core';`

## Clock

Wraps `requestAnimationFrame` into a run loop with delta-time and FPS tracking.

```ts
class Clock {
    readonly fps: number;
    readonly frames: number;
    readonly deltaTimeSeconds: number;
    readonly deltaTimeMilliseconds: number;
    readonly avgDeltaTime: number;
    readonly time: number;
    readonly isRunning: boolean;
    readonly elapsedTimeSinceStart: number;

    constructor(statsDivParent?: HTMLElement);

    run(callback: (deltaTimeSeconds: number) => void): void;
    runOnce(callback: (deltaTimeSeconds: number) => void): void; // fires the callback once, immediately, without rAF
    stop(): void;
    update(time: number): void;                // advance manually instead of via run()
    getExecuteTime(func: () => void): number;   // benchmark a function's wall time in ms
    showStats(data?: object, parent?: HTMLElement): void; // draws/updates an on-screen ClockStats overlay
}
```

```ts
import { Clock } from '@n3rdw1z4rd/core';

const clock = new Clock();

clock.run((dt) => {
    // dt is seconds since last frame
    clock.showStats({ entities: world.count }); // adds extra key/value pairs to the overlay
});
```

## ClockStats

The on-screen overlay `Clock.showStats()` uses internally. You can also use it standalone.

```ts
class ClockStats {
    divElement: HTMLDivElement;
    keyColor: string;   // default 'gray'
    valueColor: string; // default 'lightgray'

    constructor(align?: 'top' | 'bottom', justify?: 'left' | 'right');
    appendTo(target?: HTMLElement): void;
    update(data: object): void; // renders each key/value pair as a line
}
```

## Logging

Leveled console wrappers, always-on (no dev/prod gating) - `logdev`/`log` are the same function.

```ts
const logdev: typeof console.debug;
const log: typeof logdev;    // alias
const loginf: typeof console.log;
const logwrn: typeof console.log;
const logerr: typeof console.log;
```

Each prefixes and colors its output (`[dbg]` gray, `[inf]` bold, `[wrn]` orange, `[err]` red) but all still go through `console.log`/`console.debug` under the hood, so they show up in normal browser dev tools filtering.

## Input

Normalizes keyboard/mouse/wheel DOM events into an `Emitter` interface, with derived `_pressed`/`_clicked` events (down-then-up within a threshold) in addition to raw `_down`/`_up`.

```ts
class Input extends Emitter {
    inputThreshold: number; // ms window for a "pressed"/"clicked" event, default 200
    readonly mousePosition: [number, number];  // pixel offset within the window
    readonly mousePosition2: [number, number]; // normalized device coords, [-1, 1]

    isKeyDown(keyCode: string): boolean;
    getKeyState(keyCode: string): number;
    isMouseButtonDown(mouseButton: number): boolean;
    getMouseButtonState(button: number): number;
}
```

Events emitted: `key_down`, `key_up`, `key_pressed` (plus per-code variants like `space_down`/`space_up`/`space_pressed`, using `KeyboardEvent.code` lowercased), `mouse_button_down`, `mouse_button_up`, `mouse_button_clicked` (plus per-button variants like `mouse_button_0_down`), `mouse_move`, `mouse_wheel`.

```ts
import { Input } from '@n3rdw1z4rd/core';

const input = new Input();

input.on('space_pressed', () => player.jump());
input.on('mouse_move', ({ deltaX, deltaY }) => { /* ... */ });
```

`Input` listens on `window` for the lifetime of the instance - there's no `dispose()`/teardown method, so create one instance and hold onto it rather than making one per component.
