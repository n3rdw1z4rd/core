import { aStarTest } from "./astar-test";
import { regressionTest } from "./regression-test";

declare const process: { argv: string[] };

// `npm test` runs the assertions; `npm test -- astar` also draws the visual A* demo
regressionTest();

if (process.argv.includes('astar')) {
    aStarTest();
}
