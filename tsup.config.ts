import { defineConfig } from "tsup";

export default defineConfig([
    {
        // ESM: one output file per source module (plus shared chunks). Together with
        // "sideEffects" in package.json, this lets consumers' bundlers drop every module
        // they don't import, instead of pulling in the whole library and three.js.
        entry: ["src/**/*.ts", "!src/test/**", "!src/debug-label.ts"],
        format: ["esm"],
        splitting: true,
    },
    {
        // CJS (require) consumers don't tree-shake, so keep it to the two entry points
        entry: {
            index: "src/index.ts",
            three: "src/three/index.ts",
        },
        format: ["cjs"],
        // share one copy of common modules (e.g. the `rng` singleton) between the two entries
        splitting: true,
        dts: true,
    },
]);
