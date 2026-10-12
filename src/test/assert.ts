// minimal assertions and runner, so the tests don't need @types/node (this is a browser library)

declare const process: { exitCode?: number };

export type TestSuite = Record<string, () => void | Promise<void>>;

export const assert = {
    ok(value: unknown, message = 'expected a truthy value'): void {
        if (!value) throw new Error(message);
    },
    equal(actual: unknown, expected: unknown): void {
        if (!Object.is(actual, expected)) throw new Error(`expected ${String(expected)}, got ${String(actual)}`);
    },
    deepEqual(actual: unknown, expected: unknown): void {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    notDeepEqual(actual: unknown, expected: unknown): void {
        if (JSON.stringify(actual) === JSON.stringify(expected)) throw new Error(`expected values to differ: ${JSON.stringify(actual)}`);
    },
};

/** Runs every test in order; prints results and sets a failing exit code if any test fails. */
export async function runTests(...suites: TestSuite[]): Promise<void> {
    let passed = 0;
    let failed = 0;

    for (const suite of suites) {
        for (const [name, test] of Object.entries(suite)) {
            try {
                await test();
                passed++;
                console.log(`  ok   ${name}`);
            } catch (error) {
                failed++;
                console.log(`  FAIL ${name}`);
                console.log(error);
            }
        }
    }

    console.log(`${passed} passed, ${failed} failed`);

    if (failed) process.exitCode = 1;
}
