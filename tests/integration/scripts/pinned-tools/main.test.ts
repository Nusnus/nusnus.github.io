/**
 * @file The pinned-tools check runs as a script: it reports through its exit
 * code and its error output.
 */

import path from "node:path";
import { describe, expect, it } from "vitest";

import { runNodeScript } from "../../../fixtures/node-script.ts";

const SCRIPT = path.join(
  import.meta.dirname,
  "../../../../scripts/pinned-tools/main.ts",
);

describe("the script", () => {
  it("reports through its exit code and its error output", async ({
    signal,
  }) => {
    const { status, stderr } = await runNodeScript(SCRIPT, [], {
      env: { ...process.env, npm_config_user_agent: "" },
      signal,
    });

    expect({ status, stderr }).toStrictEqual({
      status: 1,
      stderr:
        'Bun does not run this check, since the npm user agent is "". Run it with `bun run check:pinned-tools`.\n',
    });
  });
});
