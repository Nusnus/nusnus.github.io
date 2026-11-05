/**
 * @file Keeps a record of each failed test run, so a failure no rerun repeats,
 * such as a flaky test in the commit hook, whose output is gone once the
 * commit is retried, can still be diagnosed. The record holds the run's seed,
 * which replays its order through `--sequence.seed`, each failed test with its
 * errors, each test file that failed outside its tests, and each error outside
 * any test file. It is a JSON file named for the seed, so no later run
 * replaces it unless it replays that seed.
 */

import type {
  Reporter,
  SerializedError,
  TestModule,
  TestRunEndReason,
  Vitest,
} from "vitest/node";

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

/** A Vitest reporter that writes the record of each failed run in a folder. */
export class FailedRunRecorder implements Reporter {
  readonly folder: string;
  #seed: number | undefined;

  constructor(folder: string) {
    this.folder = folder;
  }

  onInit(vitest: Vitest): void {
    this.#seed = vitest.config.sequence.seed;
  }

  onTestRunEnd(
    testModules: readonly TestModule[],
    unhandledErrors: readonly SerializedError[],
    reason: TestRunEndReason,
  ): void {
    if (reason !== "failed") {
      return;
    }
    mkdirSync(this.folder, { recursive: true });
    writeFileSync(
      path.join(this.folder, `failed-run-${String(this.#seed)}.json`),
      JSON.stringify(
        {
          failedTests: testModules.flatMap((testModule) =>
            Array.from(testModule.children.allTests("failed"), (test) => ({
              errors: test.result().errors,
              file: testModule.moduleId,
              name: test.fullName,
            })),
          ),
          fileErrors: testModules.flatMap((testModule) =>
            testModule.errors().map((error) => ({
              error,
              file: testModule.moduleId,
            })),
          ),
          seed: this.#seed,
          unhandledErrors,
        },
        null,
        2,
      ),
    );
  }
}
