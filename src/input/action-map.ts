import { type Binding, bindingsEqual, key, pad, padAxis } from './bindings';

export const DEFAULT_DEADZONE = 0.2;

export interface Action {
    readonly name: string,
    deadzone: number,             // raw values at or below this don't count (sticks, triggers)
    readonly bindings: Binding[],
}

export type ActionMapJSON = Record<string, { deadzone: number, bindings: Binding[] }>;

/** Named actions and the inputs bound to them, like Godot's InputMap. */
export class ActionMap {
    private readonly _actions = new Map<string, Action>();

    get names(): string[] { return [...this._actions.keys()]; }

    has(name: string): boolean {
        return this._actions.has(name);
    }

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

    clear(): this {
        this._actions.clear();
        return this;
    }

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

    /** Godot-style `ui_*` actions for menus and dialogs. */
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
