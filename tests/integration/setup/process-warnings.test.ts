/**
 * @file The process-warnings setup file, run by a real Vitest: a test that
 * raises a process warning fails once it ends, naming the warning, and a test
 * file that raises none passes beside it.
 */

import path from "node:path";
import { describe, expect, it } from "vitest";
import { createVitest, type TestModule } from "vitest/node";

import { temporaryFolder } from "../../fixtures/temporary-folder.ts";
import { TEST_TIMEOUT_MS } from "../../suite/test-timeout.ts";

const SETUP_FILE = path.join(
  import.meta.dirname,
  "../../setup/process-warnings.ts",
);
const WARNING_TEST = `import { expect, it } from "vitest";
it("warns", () => {
  process.emitWarning("the probe is deprecated", "DeprecationWarning");
  expect(1).toBe(1);
});
`;
const QUIET_TEST = `import { expect, it } from "vitest";
it("stays quiet", () => {
  expect(1).toBe(1);
});
`;

async function runVitest(
  testFiles: Readonly<Record<string, string>>,
): Promise<Record<string, readonly string[]>> {
  const root = temporaryFolder("process-warnings", testFiles);
  let testModules: readonly TestModule[] = [];
  const vitest = await createVitest({
    reporters: [
      {
        onTestRunEnd(modules) {
          testModules = modules;
        },
      },
    ],
    root,
    setupFiles: [SETUP_FILE],
    silent: true,
    testTimeout: TEST_TIMEOUT_MS,
    watch: false,
  });
  await vitest.start();
  await vitest.close();
  return Object.fromEntries(
    testModules.map((testModule) => [
      path.relative(root, testModule.moduleId),
      Array.from(
        testModule.children.allTests(),
        (test) =>
          test
            .result()
            .errors?.map(({ message }) => message)
            .join("; ") ?? test.result().state,
      ),
    ]),
  );
}

describe("process-warnings", () => {
  it("fails a test that raises a process warning once it ends, naming the warning, and passes a quiet one beside it", async () => {
    expect(
      await runVitest({
        "quiet.test.ts": QUIET_TEST,
        "warning.test.ts": WARNING_TEST,
      }),
    ).toStrictEqual({
      "quiet.test.ts": ["passed"],
      "warning.test.ts": [
        "The test raised a process warning: DeprecationWarning: the probe is deprecated. Fix its cause.",
      ],
    });
  });
});
