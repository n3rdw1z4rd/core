/**
 * `console.debug` with a bold gray `[dev]` prefix; takes the same arguments. Visible only when the
 * console shows verbose/debug messages.
 * @category Utilities
 */
export const log = console.debug.bind(
    console,
    '%c[dev]',
    'font-weight: bold; color: #888;',
);
