import { defineConfig } from "tsup";

export default defineConfig({
    entry: {
        index: "src/index.ts",
        three: "src/three/index.ts",
    },
    clean: true,
    format: ["cjs", "esm"],
    dts: true,
    // share one copy of common modules (e.g. the `rng` singleton) between the root and `three` entries
    splitting: true,
});
