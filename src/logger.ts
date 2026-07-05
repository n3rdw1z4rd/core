/** Debug-level log, prefixed `[dbg]` in gray. Aliased as {@link log}. Uses `console.debug`. */
export const logdev = console.debug.bind(console, '%c[dbg]', 'font-weight: bold; color: #888;');
/** Alias for {@link logdev} - the default logger for everyday debug output. */
export const log = logdev;
/** Info-level log, prefixed `[inf]` in bold. */
export const loginf = console.log.bind(console, '%c[inf]', 'font-weight: bold;');
/** Warning-level log, prefixed `[wrn]` in orange. */
export const logwrn = console.log.bind(console, '%c[wrn]', 'font-weight: bold; color: orange;');
/** Error-level log, prefixed `[err]` in red. */
export const logerr = console.log.bind(console, '%c[err]', 'font-weight: bold; color: red;');
