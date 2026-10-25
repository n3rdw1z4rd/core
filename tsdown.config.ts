import { defineConfig } from 'tsdown';

export default defineConfig([
    {
        // ESM: one output file per source module (unbundled). Together with "sideEffects" in
        // package.json, this lets consumers' bundlers drop every module they don't import,
        // instead of pulling in the whole library and three.js.
        entry: ['src/**/*.ts', '!src/test/**'],
        format: 'esm',
        unbundle: true,
        platform: 'browser',
        dts: true,
        clean: false, // the build script clears dist once for both configs
        copy: [{ from: 'src/css', to: 'dist' }],
    },
    {
        // CJS (require) consumers don't tree-shake, so keep it to the two entry points;
        // shared modules (e.g. the `rng` singleton) end up in one chunk both entries use
        entry: {
            index: 'src/index.ts',
            three: 'src/three/index.ts',
            vite: 'src/vite.ts',
        },
        format: 'cjs',
        platform: 'browser',
        dts: true,
        clean: false,
    },
]);
