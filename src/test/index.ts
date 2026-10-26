import { aStarTest } from "./astar-test";
import { runTests } from "./assert";
import { inputTests } from "./input-test";
import { fixesTests } from "./fixes-test";
import { regressionTests } from "./regression-test";
import { worldTests } from "./world-test";
import { editorTests } from "./editor-test";
import { graphAnimationTests, graphMultiTests, graphSkipTests, graphDisableTests, graphTests, builtinSourceTests } from "./graph-test";

declare const process: { argv: string[], exitCode?: number };

// `npm test` runs the assertions; `npm test -- astar` also draws the visual A* demo,
// and `npm test -- astar <seed>` redraws a specific map (the demo logs the seed it used)
const args = process.argv.slice(2);
const astar = args.indexOf('astar');
const seedArg = astar >= 0 ? args[astar + 1] : undefined;
const seed = seedArg === undefined ? undefined : Number(seedArg);

runTests([regressionTests, fixesTests, inputTests, worldTests, editorTests, graphTests, graphAnimationTests, graphMultiTests, graphSkipTests, graphDisableTests, builtinSourceTests]).then(() => {
    if (astar < 0) return;

    if (seed !== undefined && !Number.isFinite(seed)) {
        console.error(`astar: seed must be a number, got "${seedArg}"`);
        process.exitCode = 1;
        return;
    }

    aStarTest(seed);
});
