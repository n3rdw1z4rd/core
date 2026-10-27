/**
 * Vite plugin: lowers standard (TC39) decorators such as `@field` / `@component` with esbuild.
 *
 * Vite 8 compiles TypeScript with Oxc, which only lowers legacy `experimentalDecorators` and
 * passes standard decorators through untouched — no browser can run that yet. This runs
 * first on any source file that uses a decorator; Oxc then sees plain TS/JS.
 *
 * ```ts
 * // vite.config.ts
 * import { decorators } from '@n3rdw1z4rd/core/vite';
 * export default defineConfig({ plugins: [decorators()] });
 * ```
 *
 * Requires `esbuild` to be installed alongside Vite. Node-only: not exported from the
 * package root.
 *
 * @packageDocumentation
 * @module @n3rdw1z4rd/core/vite
 */

/**
 * The part of Vite's `Plugin` this uses, declared here so core doesn't depend on Vite
 * (structurally compatible: pass it straight to `plugins`).
 */
export interface DecoratorsPlugin {
    name: string;
    enforce: 'pre';
    transform(code: string, id: string): Promise<{ code: string; map: string } | null>;
}

type EsbuildTransform = (code: string, options: Record<string, unknown>) => Promise<{ code: string; map: string }>;

/** @category Build */
export function decorators(): DecoratorsPlugin {
    const file = /\.[cm]?[jt]sx?$/;
    const usesDecorator = /(^|[\s;{(])@[A-Za-z_$][\w$]*\s*(\(|\n|\s+[A-Za-z_$#])/m;
    let transform: EsbuildTransform | undefined;

    return {
        name: 'n3rdw1z4rd:standard-decorators',
        enforce: 'pre',
        async transform(code, id) {
            const path = id.split('?')[0];
            if (!file.test(path) || path.includes('/node_modules/') || !usesDecorator.test(code)) return null;

            const esbuild = 'esbuild'; // a variable, so bundlers leave the import to runtime
            transform ??= ((await import(/* @vite-ignore */ esbuild).catch(() => {
                throw new Error('@n3rdw1z4rd/core/vite: install esbuild (npm i -D esbuild) to compile @field decorators');
            })) as { transform: EsbuildTransform }).transform;

            const loader = path.slice(path.lastIndexOf('.') + 1).replace(/^[cm]/, '') as 'ts' | 'tsx' | 'js' | 'jsx';
            const result = await transform(code, {
                loader,
                sourcefile: path,
                sourcemap: true,
                target: 'es2022',
                jsx: 'preserve', // leave JSX to the framework plugin
                tsconfigRaw: { compilerOptions: { useDefineForClassFields: true, verbatimModuleSyntax: true } },
            });
            return { code: result.code, map: result.map };
        },
    };
}
