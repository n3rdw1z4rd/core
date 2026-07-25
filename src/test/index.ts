import { aStarTest } from "./astar-test";

const run = ((test: (...args: any[]) => void) => {
    test();
});

(async () => {
    [
        aStarTest,
    ].forEach(run);
})();
