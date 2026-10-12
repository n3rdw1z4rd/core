import { bindingLabel, key, mouse, pad, padAxis, wheel } from '../input/bindings';
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

    'ActionMap: bind / unbind / findBinding / JSON round trip; labels'() {
        const { input } = setup();
        const actions = input.actions;

        actions.add('jump', [key('Space')], { deadzone: 0.3 });
        actions.bind('jump', pad('A')).bind('jump', pad('A'));
        assert.equal(actions.get('jump')!.bindings.length, 2);

        actions.unbind('jump', key('Space'));
        assert.deepEqual(actions.get('jump')!.bindings, [pad('A')]);
        assert.deepEqual(actions.findBinding(pad('A')), ['ui_accept', 'jump']);

        const saved = JSON.parse(JSON.stringify(actions.toJSON()));
        actions.clear().load(saved);
        assert.equal(actions.get('jump')!.deadzone, 0.3);
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
