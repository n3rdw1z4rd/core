import { aStarTest } from "./astar-test";
import { runTests } from "./assert";
import { inputTests } from "./input-test";
import { regressionTests } from "./regression-test";

declare const process: { argv: string[] };

// `npm test` runs the assertions; `npm test -- astar` also draws the visual A* demo
runTests(regressionTests, inputTests).then(() => {
    if (process.argv.includes('astar')) aStarTest();
});
