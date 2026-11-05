/**
 * @file The pinned-tools check refuses to run under anything but Bun, before
 * it asks mise anything, reporting why and failing.
 */

import { describe, expect, it } from "vitest";

import { checkPinnedTools } from "../../../../scripts/pinned-tools/check.ts";

describe("checkPinnedTools", () => {
  it("refuses to run under a package manager other than Bun, before it asks mise, saying how to run it", () => {
    const reports: string[] = [];

    const exitCode = checkPinnedTools(
      "/no/such/folder",
      { npm_config_user_agent: "npm/11.6.0 node/v26.13.0 darwin arm64" },
      "26.13.0",
      (line) => reports.push(line),
    );

    expect({ exitCode, reports }).toStrictEqual({
      exitCode: 1,
      reports: [
        'Bun does not run this check, since the npm user agent is "npm/11.6.0 node/v26.13.0 darwin arm64". Run it with `bun run check:pinned-tools`.',
      ],
    });
  });
});
