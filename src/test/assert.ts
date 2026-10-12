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

const TEST_TIMEOUT = 10_000; // ms; a test that never settles fails instead of stalling the run

const withTimeout = (promise: void | Promise<void>): Promise<void> => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timed out after ${TEST_TIMEOUT} ms`)), TEST_TIMEOUT);
    });

    return Promise.race([Promise.resolve(promise), timeout]).finally(() => clearTimeout(timer));
};

export interface TestResult {
    name: string,
    ok: boolean,
    error?: string,
    ms: number,
}

export interface RunOptions {
    onResult?: (result: TestResult) => void, // called after each test (e.g. to show results on a page)
}

/** Runs every test in order; prints results, and sets a failing exit code if any test fails. */
export async function runTests(suites: TestSuite[], options: RunOptions = {}): Promise<TestResult[]> {
    const results: TestResult[] = [];

    for (const suite of suites) {
        for (const [name, test] of Object.entries(suite)) {
            const start = performance.now();
            let result: TestResult;

            try {
                await withTimeout(test());
                result = { name, ok: true, ms: performance.now() - start };
                console.log(`  ok   ${name}`);
            } catch (error) {
                result = { name, ok: false, error: error instanceof Error ? error.stack ?? error.message : String(error), ms: performance.now() - start };
                console.log(`  FAIL ${name}`);
                console.log(error);
            }

            results.push(result);
            options.onResult?.(result);
        }
    }

    const failed = results.filter(r => !r.ok).length;

    console.log(`${results.length - failed} passed, ${failed} failed`);

    if (failed) process.exitCode = 1;

    return results;
}
