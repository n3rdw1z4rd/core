import { bindingLabel, gesture, key, mouse, pad, padAxis, wheel, xr, xrAxis } from '../input/bindings';
import { GestureRecognizer } from '../input/gestures';
import { Input } from '../input/input';
import { assert, type TestSuite } from './assert';

// dispatches a plain Event carrying the given properties (Node has no KeyboardEvent / PointerEvent)
const fire = (target: EventTarget, type: string, props: object = {}): Event => {
    const event = new Event(type, { cancelable: true });

    Object.assign(event, props);
    target.dispatchEvent(event);

    return event;
};

const setup = () => {
    const keyboard = new EventTarget();
    const canvas = new EventTarget();
    const input = new Input(canvas, { keyboardTarget: keyboard });

    const down = (code: string, props: object = {}) => fire(keyboard, 'keydown', { code, ...props });
    const up = (code: string) => fire(keyboard, 'keyup', { code });

    return { input, keyboard, canvas, down, up };
};

export const inputTests: TestSuite = {
    'Input: pressed / just pressed / just released follow update() frames'() {
        const { input, down, up } = setup();

        input.actions.add('jump', [key('Space'), pad('A')]);

        down('Space');
        assert.ok(!input.isActionPressed('jump')); // nothing changes until update()

        input.update();
        assert.ok(input.isActionPressed('jump'));
        assert.ok(input.isActionJustPressed('jump'));
        assert.equal(input.getActionStrength('jump'), 1);

        down('Space', { repeat: true }); // key repeat is not a new press
        input.update();
        assert.ok(input.isActionPressed('jump'));
        assert.ok(!input.isActionJustPressed('jump'));

        up('Space');
        input.update();
        assert.ok(!input.isActionPressed('jump'));
        assert.ok(input.isActionJustReleased('jump'));

        input.update();
        assert.ok(!input.isActionJustReleased('jump'));
    },

    'Input: a press and release between two frames still counts once'() {
        const { input, down, up } = setup();

        input.actions.add('fire', [key('KeyF')]);

        down('KeyF');
        up('KeyF');

        input.update();
        assert.ok(input.isActionJustPressed('fire'));

        input.update();
        assert.ok(input.isActionJustReleased('fire'));
    },

    'Input: modifiers, defaults, unknown actions, raw key state'() {
        const { input, down, up } = setup();

        input.actions.add('save', [key('KeyS', { ctrl: true })]);
        input.actions.add('back', [key('KeyS')]);

        down('KeyS');
        input.update();
        assert.ok(!input.isActionPressed('save'));
        assert.ok(input.isActionPressed('back'));
        assert.ok(input.isKeyPressed('KeyS'));

        up('KeyS');
        down('ControlLeft');
        down('KeyS');
        input.update();
        assert.ok(input.isActionJustPressed('save'));

        down('Enter');
        input.update();
        assert.ok(input.isActionJustPressed('ui_accept')); // defaults are on

        const warn = console.warn;
        let warnings = 0;
        console.warn = () => { warnings++; };

        try {
            assert.ok(!input.isActionPressed('jmup'));
            assert.ok(!input.isActionPressed('jmup'));
            assert.equal(warnings, 1); // typo warned about, once
        } finally {
            console.warn = warn;
        }

        assert.ok(!new Input(undefined, { keyboardTarget: new EventTarget(), defaults: false }).actions.has('ui_accept'));
    },

    'Input: getAxis and getVector (diagonals are not faster)'() {
        const { input, down, up } = setup();

        input.actions.add('left', [key('KeyA')]).add('right', [key('KeyD')]).add('up', [key('KeyW')]).add('down', [key('KeyS')]);

        down('KeyD');
        input.update();
        assert.equal(input.getAxis('left', 'right'), 1);
        assert.deepEqual(input.getVector('left', 'right', 'up', 'down'), { x: 1, y: 0 });

        down('KeyW');
        input.update();
        const v = input.getVector('left', 'right', 'up', 'down');
        assert.ok(Math.abs(Math.hypot(v.x, v.y) - 1) < 1e-9 && v.x > 0 && v.y < 0);

        up('KeyD');
        up('KeyW');
        input.update();
        assert.deepEqual(input.getVector('left', 'right', 'up', 'down'), { x: 0, y: 0 });
    },

    'Input: mouse buttons (incl. chorded), movement, wheel steps, last device'() {
        const { input, canvas, down } = setup();

        input.actions.add('fire', [mouse('left')]).add('aim', [mouse('right')]).add('zoom_in', [wheel('up')]);

        const devices: string[] = [];
        input.onDeviceChange.subscribe(d => devices.push(d));

        fire(canvas, 'pointerdown', { pointerType: 'mouse', button: 0, buttons: 1, clientX: 10, clientY: 20 });
        fire(canvas, 'pointermove', { pointerType: 'mouse', button: 2, buttons: 3, clientX: 15, clientY: 18, movementX: 5, movementY: -2 }); // right pressed while left held
        fire(canvas, 'pointermove', { pointerType: 'mouse', button: -1, buttons: 3, clientX: 16, clientY: 19, movementX: 1, movementY: 1 });

        const wheelEvent = fire(canvas, 'wheel', { deltaY: -100, deltaX: 0, deltaMode: 0 });

        input.update();
        assert.ok(input.isActionPressed('fire') && input.isActionPressed('aim'));
        assert.ok(input.isActionJustPressed('zoom_in'));
        assert.ok(wheelEvent.defaultPrevented); // wheel is bound: don't scroll the page
        assert.equal(input.pointer.deltaX, 6);
        assert.equal(input.pointer.deltaY, -1);
        assert.equal(input.pointer.wheelY, -100);
        assert.equal(input.pointer.x, 16);
        assert.equal(input.pointer.y, 19);

        input.update();
        assert.ok(!input.isActionPressed('zoom_in')); // a wheel step lasts one frame
        assert.equal(input.pointer.deltaX, 0);

        fire(canvas, 'pointermove', { pointerType: 'mouse', button: 2, buttons: 1, clientX: 16, clientY: 19 }); // right released, left still held
        input.update();
        assert.ok(input.isActionJustReleased('aim') && input.isActionPressed('fire'));

        down('KeyQ');
        assert.deepEqual(devices, ['mouse', 'keyboard']);
    },

    'Input: onAction callbacks, blur releases held actions, preventDefault only for bound keys'() {
        const { input, keyboard, down } = setup();
        const events: string[] = [];

        input.actions.add('jump', [key('Space')]);

        const unsubscribe = input.onAction('jump', 'pressed', () => events.push('pressed'));
        input.onAction('jump', 'released', () => events.push('released'));

        assert.ok(down('Space').defaultPrevented);
        assert.ok(!down('KeyQ').defaultPrevented);

        input.update();
        fire(keyboard, 'blur'); // window lost focus while Space was held
        input.update();
        assert.ok(!input.isActionPressed('jump'));
        assert.deepEqual(events, ['pressed', 'released']);

        unsubscribe();
        down('Space');
        input.update();
        assert.deepEqual(events, ['pressed', 'released']);
    },

    async 'Input: captureBinding for rebinding menus'() {
        const { input, canvas, down } = setup();

        input.actions.add('jump', [key('Space')]);

        const captured = input.captureBinding();
        down('Space');
        assert.deepEqual(await captured, key('Space'));

        input.update();
        assert.ok(!input.isActionPressed('jump')); // the captured press doesn't trigger the action

        const cancelled = input.captureBinding();
        down('Escape');
        assert.equal(await cancelled, null);

        const mouseOnly = input.captureBinding({ types: ['mouse'] });
        down('KeyX'); // ignored
        fire(canvas, 'pointerdown', { pointerType: 'mouse', button: 2, buttons: 2 });
        assert.deepEqual(await mouseOnly, mouse('right'));
    },

    async 'Input: gamepads (buttons, analog, sticks, per-device queries, connect / disconnect, capture)'() {
        const { input, down } = setup();

        const fakePad = (index: number) => ({
            index, id: `Pad ${index}`, mapping: 'standard', connected: true,
            buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
            axes: [0, 0, 0, 0],
        });

        const pads: (ReturnType<typeof fakePad> | null)[] = [fakePad(0), null, fakePad(2)];
        const nav = globalThis.navigator as any;
        const original = Object.getOwnPropertyDescriptor(nav, 'getGamepads');

        Object.defineProperty(nav, 'getGamepads', { value: () => pads, configurable: true });

        try {
            const connected: number[] = [];
            const disconnected: number[] = [];

            input.onGamepadConnected.subscribe(p => connected.push(p.device));
            input.onGamepadDisconnected.subscribe(p => disconnected.push(p.device));

            input.actions.add('jump', [key('Space'), pad('A')]);
            input.actions.add('accelerate', [pad('RT')]);
            input.actions.add('left', [padAxis('leftX', -1)]).add('right', [padAxis('leftX', 1)]);
            input.actions.add('up', [padAxis('leftY', -1)]).add('down', [padAxis('leftY', 1)]);

            input.update();
            assert.deepEqual(connected, [1, 3]); // device = gamepad index + 1
            assert.deepEqual(input.gamepads.map(p => p.device), [1, 3]);

            // player 2 (pad index 2 -> device 3) jumps
            pads[2]!.buttons[0] = { pressed: true, value: 1 };
            input.update();
            assert.ok(input.isActionJustPressed('jump'));
            assert.ok(input.isActionJustPressed('jump', { device: 3 }));
            assert.ok(!input.isActionPressed('jump', { device: 1 }));
            assert.ok(!input.isActionPressed('jump', { device: 0 }));
            assert.equal(input.lastDevice, 'gamepad');

            // analog trigger: strength rescaled past the deadzone (0.2)
            pads[0]!.buttons[7] = { pressed: true, value: 0.6 };
            input.update();
            assert.ok(Math.abs(input.getActionStrength('accelerate') - 0.5) < 1e-9);
            assert.equal(input.getActionRawStrength('accelerate', { device: 1 }), 0.6);

            // stick: small drift ignored, full tilt diagonal clamped to length 1
            pads[0]!.axes = [0.1, -0.05, 0, 0];
            input.update();
            assert.deepEqual(input.getVector('left', 'right', 'up', 'down'), { x: 0, y: 0 });

            pads[0]!.axes = [1, -1, 0, 0];
            input.update();
            const v = input.getVector('left', 'right', 'up', 'down');
            assert.ok(Math.abs(Math.hypot(v.x, v.y) - 1) < 1e-9 && v.x > 0 && v.y < 0);

            // keyboard on device 0 still works alongside
            down('Space');
            input.update();
            assert.ok(input.isActionPressed('jump', { device: 0 }));

            // capture a stick direction
            pads[0]!.axes = [0, 0, 0, 0];
            input.update();
            const captured = input.captureBinding();
            pads[0]!.axes = [0, 0, -0.9, 0];
            input.update();
            assert.deepEqual(await captured, padAxis('rightX', -1));

            // player 2 unplugs while holding A: released, and reported
            const released: string[] = [];
            input.onAction('jump', 'released', () => released.push('jump'), { device: 3 });

            pads[2] = null;
            input.update();
            assert.deepEqual(disconnected, [3]);
            assert.deepEqual(released, ['jump']);
            assert.deepEqual(input.gamepads.map(p => p.device), [1]);
        } finally {
            if (original) Object.defineProperty(nav, 'getGamepads', original);
            else delete nav.getGamepads;
        }
    },

    'Input: auto-repeat for held actions (delay, interval, no catch-up burst)'() {
        const { input, down, up } = setup();
        const presses: [number, boolean][] = [];

        input.actions.add('walk', [key('ArrowRight')], { repeat: { delay: 300, interval: 100 } });
        input.actions.add('jump', [key('Space')]);
        input.onAction('walk', 'pressed', ({ repeat }) => presses.push([t, repeat]));

        let t = 0;
        const frame = (time: number) => { t = time; input.update(time); };

        down('ArrowRight');
        down('Space');
        frame(0);
        assert.ok(input.isActionJustPressed('walk') && !input.isActionRepeated('walk'));

        frame(200);
        assert.ok(!input.isActionJustPressed('walk')); // still inside the delay
        frame(300);
        assert.ok(input.isActionJustPressed('walk') && input.isActionRepeated('walk'));
        frame(350);
        frame(400);
        frame(1000); // a stall: one repeat, not six
        frame(1016);
        frame(1100);
        assert.ok(!input.isActionJustPressed('jump')); // no repeat unless the action asks for it

        up('ArrowRight');
        frame(1200);
        assert.deepEqual(presses, [[0, false], [300, true], [400, true], [1000, true], [1100, true]]);

        // ui_* directions repeat by default
        down('ArrowUp');
        frame(2000);
        frame(2000 + 400);
        assert.ok(input.isActionRepeated('ui_up'));
    },

    'GestureRecognizer: tap, double tap, long press, swipes'() {
        const g = new GestureRecognizer();

        g.down(1, 100, 100, 0);
        g.up(1, 103, 102, 120);
        assert.deepEqual(g.update(130).events, [{ gesture: 'tap', x: 103, y: 102 }]); // where it lifted

        g.down(1, 105, 100, 300); // second tap 180ms later, nearby
        g.up(1, 105, 100, 380);
        assert.deepEqual(g.update(390).gestures, ['tap', 'doubleTap']);

        g.down(1, 105, 100, 500); // third tap: a plain tap again
        g.up(1, 105, 100, 560);
        assert.deepEqual(g.update(570).gestures, ['tap']);

        g.down(1, 0, 0, 1000);
        assert.deepEqual(g.update(1400).gestures, []);
        assert.deepEqual(g.update(1520).events, [{ gesture: 'longPress', x: 0, y: 0 }]); // fires once, while held
        assert.deepEqual(g.update(1700).gestures, []);
        g.up(1, 0, 0, 1800);
        assert.deepEqual(g.update(1810).gestures, []); // no tap after a long press

        for (const [dx, dy, expected] of [[120, 10, 'swipeRight'], [-80, 0, 'swipeLeft'], [5, -90, 'swipeUp'], [0, 60, 'swipeDown']] as const) {
            g.down(2, 200, 200, 2000);
            g.move(2, 200 + dx / 2, 200 + dy / 2);
            g.up(2, 200 + dx, 200 + dy, 2200);
            assert.deepEqual(g.update(2210).events, [{ gesture: expected, x: 200, y: 200 }]); // where it started
        }

        g.down(3, 0, 0, 3000); // too slow for a swipe, moved too far for a tap
        g.up(3, 300, 0, 3900);
        assert.deepEqual(g.update(3910).gestures, []);
    },

    'GestureRecognizer: two-finger pinch, pan and rotate; two fingers are not taps'() {
        const g = new GestureRecognizer();

        g.down(1, 100, 100, 0);
        g.down(2, 200, 100, 10);
        assert.equal(g.update(20).pinch, 1); // first frame with two fingers only sets the baseline

        g.move(1, 50, 100);
        g.move(2, 250, 100); // distance 100 -> 200
        let frame = g.update(40);
        assert.equal(frame.pinch, 2);
        assert.deepEqual(frame.gestures, ['pinchOut']);

        g.move(1, 60, 110);
        g.move(2, 260, 110); // both down by 10, right by 10
        frame = g.update(60);
        assert.equal(frame.pinch, 1);
        assert.deepEqual(frame.pan, { x: 10, y: 10 });
        assert.deepEqual(frame.gestures, []);

        g.move(1, 160, 10);
        g.move(2, 160, 210); // rotated a quarter turn clockwise (on screen) around the same center
        frame = g.update(80);
        assert.ok(Math.abs(frame.rotate - Math.PI / 2) < 1e-9);

        g.up(1, 160, 10, 100);
        g.up(2, 160, 210, 100);
        assert.deepEqual(g.update(110).gestures, []); // not taps
        assert.equal(g.touches.length, 0);
    },

    'Input: touch feeds gestures into actions, not the mouse'() {
        const { input, canvas } = setup();

        input.actions.add('select', [gesture('tap')]).add('zoom_in', [gesture('pinchOut')]).add('fire', [mouse('left')]);

        fire(canvas, 'pointerdown', { pointerType: 'touch', pointerId: 7, button: 0, buttons: 1, clientX: 30, clientY: 40 });
        assert.deepEqual(input.touches.map(t => [t.id, t.x, t.y]), [[7, 30, 40]]);
        assert.equal(input.lastDevice, 'touch');

        fire(canvas, 'pointerup', { pointerType: 'touch', pointerId: 7, button: 0, buttons: 0, clientX: 31, clientY: 40 });

        input.update();
        assert.ok(input.isActionJustPressed('select'));
        assert.ok(!input.isActionPressed('fire'));
        assert.deepEqual(input.gestures.events, [{ gesture: 'tap', x: 31, y: 40 }]); // where the tap was

        input.update();
        assert.ok(!input.isActionPressed('select')); // gestures are one-frame presses

        fire(canvas, 'pointerdown', { pointerType: 'touch', pointerId: 1, clientX: 100, clientY: 100 });
        fire(canvas, 'pointerdown', { pointerType: 'touch', pointerId: 2, clientX: 200, clientY: 100 });
        input.update();

        fire(canvas, 'pointermove', { pointerType: 'touch', pointerId: 2, clientX: 300, clientY: 100 });
        input.update();
        assert.equal(input.gestures.pinch, 2);
        assert.ok(input.isActionJustPressed('zoom_in'));

        fire(canvas, 'pointercancel', { pointerType: 'touch', pointerId: 1 });
        fire(canvas, 'pointercancel', { pointerType: 'touch', pointerId: 2 });
        input.update();
        assert.equal(input.touches.length, 0);
        assert.equal(input.gestures.pinch, 1);
    },

    async 'Input: VR controllers (buttons, thumbsticks, controller loss, session end, capture)'() {
        const { input } = setup();

        const controller = (handedness: string) => ({
            handedness,
            gamepad: { buttons: Array.from({ length: 6 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] },
        });

        const left = controller('left');
        const right = controller('right');
        const session = Object.assign(new EventTarget(), { inputSources: [left, right] as ReturnType<typeof controller>[] });

        input.actions.add('fire', [mouse('left'), xr('right', 'trigger')]);
        input.actions.add('jump', [xr('right', 'primary')]);
        input.actions.add('move_left', [xrAxis('left', 'thumbX', -1)]).add('move_right', [xrAxis('left', 'thumbX', 1)]);
        input.actions.add('move_forward', [xrAxis('left', 'thumbY', -1)]).add('move_back', [xrAxis('left', 'thumbY', 1)]);

        input.attachXR(session);

        right.gamepad.buttons[0] = { pressed: true, value: 0.9 }; // trigger
        right.gamepad.buttons[4] = { pressed: true, value: 1 };   // A
        left.gamepad.axes = [0, 0, 0, -1];                        // left thumbstick pushed forward
        input.update();

        assert.ok(input.isActionJustPressed('fire'));
        assert.ok(input.isActionPressed('jump', { device: 0 })); // VR is device 0, with keyboard and mouse
        assert.deepEqual(input.getVector('move_left', 'move_right', 'move_forward', 'move_back'), { x: 0, y: -1 });
        assert.equal(input.lastDevice, 'xr');

        // the right controller disappears (switched off / hand tracking): its buttons release
        session.inputSources = [left];
        input.update();
        assert.ok(input.isActionJustReleased('fire'));
        assert.ok(input.isActionPressed('move_forward'));

        // capture a VR button for rebinding
        const captured = input.captureBinding();
        left.gamepad.buttons[1] = { pressed: true, value: 1 }; // left squeeze
        input.update();
        assert.deepEqual(await captured, xr('left', 'squeeze'));

        // session ends: everything from the controllers is released, polling stops
        session.dispatchEvent(new Event('end'));
        assert.equal(input.xrSession, undefined);
        input.update();
        assert.ok(input.isActionJustReleased('move_forward'));
    },

    'ActionMap: bind / unbind / findBinding / JSON round trip; labels'() {
        const { input } = setup();
        const actions = input.actions;

        actions.add('jump', [key('Space')], { deadzone: 0.3 });
        actions.add('walk', [key('KeyD')], { repeat: true });
        assert.deepEqual(actions.get('walk')!.repeat, { delay: 400, interval: 100 });
        actions.add('walk', [key('ArrowRight')]); // replacing bindings keeps the repeat
        assert.deepEqual(actions.get('walk')!.repeat, { delay: 400, interval: 100 });
        actions.add('walk', [key('ArrowRight')], { repeat: { interval: 50 } });
        assert.deepEqual(actions.get('walk')!.repeat, { delay: 400, interval: 50 });
        actions.bind('jump', pad('A')).bind('jump', pad('A'));
        assert.equal(actions.get('jump')!.bindings.length, 2);

        actions.unbind('jump', key('Space'));
        assert.deepEqual(actions.get('jump')!.bindings, [pad('A')]);
        assert.deepEqual(actions.findBinding(pad('A')), ['ui_accept', 'jump']);

        const saved = JSON.parse(JSON.stringify(actions.toJSON()));
        actions.clear().load(saved);
        assert.equal(actions.get('jump')!.deadzone, 0.3);
        assert.equal(actions.get('jump')!.repeat, undefined);
        assert.deepEqual(actions.get('walk')!.repeat, { delay: 400, interval: 50 });
        assert.deepEqual(actions.get('jump')!.bindings, [pad('A')]);

        assert.equal(bindingLabel(key('KeyW')), 'W');
        assert.equal(bindingLabel(key('KeyW'), new Map([['KeyW', 'z']])), 'Z'); // AZERTY layout
        assert.equal(bindingLabel(key('KeyS', { ctrl: true })), 'Ctrl+S');
        assert.equal(bindingLabel(padAxis('leftX', -1)), 'Left Stick Left');
        assert.equal(bindingLabel(mouse('right')), 'Mouse Right');
    },

    'Input: dispose removes listeners'() {
        const { input, down } = setup();

        input.actions.add('jump', [key('Space')]);
        input.dispose();

        down('Space');
        input.update();
        assert.ok(!input.isActionPressed('jump'));
    },
};
