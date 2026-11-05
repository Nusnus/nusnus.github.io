/**
 * @file The fake network's lifecycle, in a real Vitest run of a test file
 * that uses it: a replay answers only the test that set it up, and a request
 * no replay answers fails as an unreachable network fails it, even one for a
 * .json file, which MSW's own strategies let through to the real network.
 */

import path from "node:path";
import { describe, expect, it } from "vitest";
import { createVitest, type TestModule } from "vitest/node";

import { temporaryFolder } from "../../../fixtures/temporary-folder.ts";
import { TEST_TIMEOUT_MS } from "../../../suite/test-timeout.ts";

const NETWORK = path.join(
  import.meta.dirname,
  "../../../fixtures/services/network.ts",
);
// Two tests, run in order: the first replays the release schedule, and the
// second asks for it with no replay of its own.
const TWO_TESTS = `import { expect, it } from "vitest";
import { recorded, replayServices, useFakeNetwork } from ${JSON.stringify(NETWORK)};
useFakeNetwork();
const SCHEDULE_URL = "https://raw.githubusercontent.com/nodejs/Release/main/schedule.json";
it("replays", async () => {
  replayServices(recorded("node/schedule"));
  expect((await fetch(SCHEDULE_URL)).status).toBe(200);
});
it("asks with no replay", async () => {
  await fetch(SCHEDULE_URL);
});
`;

describe("useFakeNetwork", () => {
  it("answers a request only with the replays of the test that sent it, and fails one no replay answers", async () => {
    let testModules: readonly TestModule[] = [];
    const vitest = await createVitest({
      reporters: [
        {
          onTestRunEnd(modules) {
            testModules = modules;
          },
        },
      ],
      root: temporaryFolder("fake-network", { "network.test.ts": TWO_TESTS }),
      sequence: { shuffle: false },
      silent: true,
      testTimeout: TEST_TIMEOUT_MS,
      watch: false,
    });
    await vitest.start();
    await vitest.close();

    expect(
      testModules.flatMap((testModule) =>
        Array.from(testModule.children.allTests(), (test) => [
          test.name,
          test.result().state,
          test.result().errors?.map(({ message }) => message),
        ]),
      ),
    ).toStrictEqual([
      ["replays", "passed", undefined],
      ["asks with no replay", "failed", ["fetch failed"]],
    ]);
  });
});
