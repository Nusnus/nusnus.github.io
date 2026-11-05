/**
 * @file Makes each process warning, such as a deprecation, fail the test that
 * raised it. Node emits a warning on a later tick, so each test waits for
 * the warnings it raised before it ends.
 */

import { afterEach, beforeAll } from "vitest";

/** The process warnings a test raised. */
export class ProcessWarningError extends Error {
  override name = "ProcessWarningError";
}

/**
 * The process warnings raised while a test runs, which fail that test once it
 * ends.
 */
export class RaisedWarnings {
  readonly #warnings: Error[] = [];

  readonly collect = (warning: Error): void => {
    this.#warnings.push(warning);
  };

  async failOnAny(): Promise<void> {
    await new Promise((resolve) => {
      setImmediate(resolve);
    });
    const warnings = this.#warnings.splice(0);
    if (warnings.length > 0) {
      throw new ProcessWarningError(
        `The test raised a process warning: ${warnings.map(String).join("; ")}. Fix its cause.`,
      );
    }
  }
}

export const raisedWarnings = new RaisedWarnings();

// Vitest runs each test file, and this file before it, in a fresh process or
// isolate, so the listener ends with its test file.
beforeAll(() => {
  process.on("warning", raisedWarnings.collect);
});
// Only a Vitest run of its own, which the setup file's integration test
// starts, shows this hook failing a test, and mutation testing does not see
// into that run.
// Stryker disable next-line ArrowFunction
afterEach(() => raisedWarnings.failOnAny());
