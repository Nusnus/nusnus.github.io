/**
 * @file The wait for a deployed worker version runs as a script: it prints its
 * report to stdout and exits with the code its wait returns.
 */

import path from "node:path";
import { describe, expect, it } from "vitest";

import { runNodeScript } from "../../../fixtures/node-script.ts";

const SCRIPT = path.join(
  import.meta.dirname,
  "../../../../scripts/worker-version/main.ts",
);

describe("the script", () => {
  it("prints its report to stdout and exits with code 1 when the wait fails", async ({
    signal,
  }) => {
    // No version to wait for fails the wait before it asks the worker.
    const { status, stdout } = await runNodeScript(SCRIPT, [], {
      env: {},
      signal,
    });

    expect({ status, stdout }).toStrictEqual({
      status: 1,
      stdout:
        "Set WORKER_VERSION_ID to the id of the worker version to wait for, as the Deploy workflow does from Wrangler's report of its deploy.\n",
    });
  });
});
