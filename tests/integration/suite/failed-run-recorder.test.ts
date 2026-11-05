/**
 * @file FailedRunRecorder, reporting a real Vitest run: a failed run leaves a
 * record named for its seed, with each failed test and its errors, each test
 * file that failed outside its tests and the errors outside any file; a
 * passing run leaves none.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createVitest } from "vitest/node";

import { temporaryFolder } from "../../fixtures/temporary-folder.ts";
import { FailedRunRecorder } from "../../suite/failed-run-recorder.ts";
import { TEST_TIMEOUT_MS } from "../../suite/test-timeout.ts";

const PASSING_TEST = `import { expect, it } from "vitest";
it("adds", () => {
  expect(1 + 1).toBe(2);
});
`;
const FAILING_TEST = `import { describe, expect, it } from "vitest";
describe("addition", () => {
  it("is wrong", () => {
    expect(1 + 1).toBe(3);
  });
});
`;
const BROKEN_FILE = `throw new Error("the file cannot load");
`;
const UNHANDLED_REJECTION = `import { expect, it } from "vitest";
it("leaves a rejection nothing awaits", () => {
  void Promise.reject(new Error("nothing awaits this"));
  expect(1).toBe(1);
});
`;

async function runVitest(
  testFiles: Readonly<Record<string, string>>,
): Promise<{ recordFolder: string; root: string }> {
  const root = temporaryFolder("vitest", testFiles);
  const recordFolder = path.join(root, "reports/vitest");
  const vitest = await createVitest({
    reporters: [new FailedRunRecorder(recordFolder)],
    root,
    sequence: { seed: 42, shuffle: true },
    testTimeout: TEST_TIMEOUT_MS,
    watch: false,
  });
  await vitest.start();
  await vitest.close();
  return { recordFolder, root };
}

describe("FailedRunRecorder", () => {
  it("records a failed run under its seed: each failed test with its errors, each file that failed outside its tests, and the errors outside any file", async () => {
    const { recordFolder, root } = await runVitest({
      "broken.test.ts": BROKEN_FILE,
      "failing.test.ts": FAILING_TEST,
      "passing.test.ts": PASSING_TEST,
      "unhandled.test.ts": UNHANDLED_REJECTION,
    });

    expect(
      JSON.parse(
        readFileSync(path.join(recordFolder, "failed-run-42.json"), "utf8"),
      ),
    ).toStrictEqual({
      failedTests: [
        {
          errors: [
            expect.objectContaining({
              message: "expected 2 to be 3 // Object.is equality",
            }) as unknown,
          ],
          file: path.join(root, "failing.test.ts"),
          name: "addition > is wrong",
        },
      ],
      fileErrors: [
        {
          error: expect.objectContaining({
            message: "the file cannot load",
          }) as unknown,
          file: path.join(root, "broken.test.ts"),
        },
      ],
      seed: 42,
      unhandledErrors: [
        expect.objectContaining({
          message: "nothing awaits this",
        }) as unknown,
      ],
    });
  });

  it("records nothing for a passing run", async () => {
    const { recordFolder } = await runVitest({
      "passing.test.ts": PASSING_TEST,
    });

    expect(existsSync(recordFolder)).toBe(false);
  });
});
