/**
 * @file A process warning fails the test that raised it, naming each warning,
 * with an error that names itself, and a test that raises none passes.
 */

import { describe, expect, it, vi } from "vitest";

import {
  ProcessWarningError,
  raisedWarnings,
} from "../../setup/process-warnings.ts";

describe("ProcessWarningError", () => {
  it("names itself where it prints", () => {
    expect(String(new ProcessWarningError("probe"))).toBe(
      "ProcessWarningError: probe",
    );
  });
});

describe("raisedWarnings", () => {
  it("fails the test that raised a process warning, naming the warning", async () => {
    // Node also prints each warning, which workerd and happy-dom do not, so
    // this silences what Node prints without asserting it.
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    process.emitWarning("the probe is deprecated", "DeprecationWarning");

    await expect(raisedWarnings.failOnAny()).rejects.toThrow(
      new ProcessWarningError(
        "The test raised a process warning: DeprecationWarning: the probe is deprecated. Fix its cause.",
      ),
    );
  });

  it("names each of several process warnings", async () => {
    // Node also prints each warning, which workerd and happy-dom do not, so
    // this silences what Node prints without asserting it.
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    process.emitWarning("the probe is deprecated", "DeprecationWarning");
    process.emitWarning("the probe leaks", "MaxListenersExceededWarning");

    await expect(raisedWarnings.failOnAny()).rejects.toThrow(
      new ProcessWarningError(
        "The test raised a process warning: DeprecationWarning: the probe is deprecated; MaxListenersExceededWarning: the probe leaks. Fix its cause.",
      ),
    );
  });

  it("lets a test that raised no process warning pass", async () => {
    await expect(raisedWarnings.failOnAny()).resolves.toBeUndefined();
  });
});
