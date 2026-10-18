import { type Binding, bindingsEqual, key, pad, padAxis } from './bindings';

/**
 * Deadzone given to new actions when none is specified.
 *
 * @category Input
 */
export const DEFAULT_DEADZONE = 0.2;

/**
 * A named action in an {@link ActionMap}.
 *
 * @category Input
 */
export interface Action {
    /** the action's name */
    readonly name: string,
    /** raw values at or below this don't count (sticks, triggers) */
    deadzone: number,
    /** inputs that trigger the action; the strongest one wins */
    readonly bindings: Binding[],
}

/**
 * The serialized form of an {@link ActionMap} (from {@link ActionMap.toJSON}), keyed by action name.
 *
 * Each entry holds the action's `deadzone` and `bindings` (see {@link Action}).
 *
 * @category Input
 */
export type ActionMapJSON = Record<string, { deadzone: number, bindings: Binding[] }>;

/**
 * Named actions and the inputs bound to them, like Godot's InputMap. Every {@link Input} has one as
 * {@link Input.actions}; the methods that change it return `this` for chaining.
 *
 * ```ts
 * input.actions
 *     .add('jump', [key('Space'), pad('A')])
 *     .bind('jump', gesture('tap'));
 *
 * localStorage.setItem('bindings', JSON.stringify(input.actions));
 * ```
 *
 * @category Input
 */
export class ActionMap {
    private readonly _actions = new Map<string, Action>();

    /** action names, in the order they were added */
    get names(): string[] { return [...this._actions.keys()]; }

    /** Whether an action with this name exists. */
    has(name: string): boolean {
        return this._actions.has(name);
    }

    /** The action with this name, or `undefined`. */
    get(name: string): Action | undefined {
        return this._actions.get(name);
    }

    /** Adds an action, or replaces its bindings (and deadzone, if given) if it exists. */
    add(name: string, bindings: Binding[] = [], options: { deadzone?: number } = {}): this {
        const existing = this._actions.get(name);

        this._actions.set(name, {
            name,
            deadzone: options.deadzone ?? existing?.deadzone ?? DEFAULT_DEADZONE,
            bindings: [...bindings],
        });

        return this;
    }

    /** Removes an action, if it exists. */
    remove(name: string): this {
        this._actions.delete(name);
        return this;
    }

    /** Adds a binding to an action (creating the action if needed); duplicates are ignored. */
    bind(name: string, binding: Binding): this {
        if (!this._actions.has(name)) this.add(name);

        const action = this._actions.get(name)!;

        if (!action.bindings.some(b => bindingsEqual(b, binding))) {
            action.bindings.push(binding);
        }

        return this;
    }

    /** Removes a binding (compared with {@link bindingsEqual}) from an action, if present. */
    unbind(name: string, binding: Binding): this {
        const action = this._actions.get(name);

        if (action) {
            const i = action.bindings.findIndex(b => bindingsEqual(b, binding));
            if (i >= 0) action.bindings.splice(i, 1);
        }

        return this;
    }

    /** Actions that already use this binding, e.g. to warn about conflicts when rebinding. */
    findBinding(binding: Binding): string[] {
        return this.names.filter(name => this._actions.get(name)!.bindings.some(b => bindingsEqual(b, binding)));
    }

    /** Removes all actions. */
    clear(): this {
        this._actions.clear();
        return this;
    }

    /** A JSON-serializable copy of all actions, for saving rebinds; see {@link ActionMap.load}. */
    toJSON(): ActionMapJSON {
        const json: ActionMapJSON = {};

        for (const action of this._actions.values()) {
            json[action.name] = { deadzone: action.deadzone, bindings: action.bindings.map(b => ({ ...b })) };
        }

        return json;
    }

    /** Replaces all actions with the saved ones (e.g. a player's rebinds). */
    load(json: ActionMapJSON): this {
        this.clear();

        for (const [name, action] of Object.entries(json)) {
            this.add(name, action.bindings, { deadzone: action.deadzone });
        }

        return this;
    }

    /**
     * Godot-style `ui_*` actions for menus and dialogs (`ui_accept`, `ui_cancel`, `ui_left`, `ui_right`,
     * `ui_up`, `ui_down`, `ui_page_up`, `ui_page_down`), with a 0.5 deadzone; replaces existing ones.
     */
    addDefaults(): this {
        const ui = { deadzone: 0.5 };

        this.add('ui_accept', [key('Enter'), key('NumpadEnter'), key('Space'), pad('A')], ui);
        this.add('ui_cancel', [key('Escape'), pad('B')], ui);
        this.add('ui_left', [key('ArrowLeft'), pad('DpadLeft'), padAxis('leftX', -1)], ui);
        this.add('ui_right', [key('ArrowRight'), pad('DpadRight'), padAxis('leftX', 1)], ui);
        this.add('ui_up', [key('ArrowUp'), pad('DpadUp'), padAxis('leftY', -1)], ui);
        this.add('ui_down', [key('ArrowDown'), pad('DpadDown'), padAxis('leftY', 1)], ui);
        this.add('ui_page_up', [key('PageUp'), pad('LB')], ui);
        this.add('ui_page_down', [key('PageDown'), pad('RB')], ui);

        return this;
    }
}
