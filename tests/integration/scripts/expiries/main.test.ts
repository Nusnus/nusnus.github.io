/**
 * @file The expiry check runs as a script: it prints its report to stdout and
 * exits with the code its check returns.
 */

import path from "node:path";
import { describe, expect, it } from "vitest";

import { runNodeScript } from "../../../fixtures/node-script.ts";

const SCRIPT = path.join(
  import.meta.dirname,
  "../../../../scripts/expiries/main.ts",
);

describe("the script", () => {
  it("prints its report to stdout and exits with code 1 when the check fails", async ({
    signal,
  }) => {
    // No environment variables fail the check before it asks any service.
    const { status, stdout } = await runNodeScript(SCRIPT, [], {
      env: {},
      signal,
    });

    expect({ status, stdout }).toStrictEqual({
      status: 1,
      stdout:
        "::error::The check's environment variables are missing or invalid:%0A" +
        "✖ Invalid input: expected string, received undefined%0A  → at CLOUDFLARE_API_TOKEN%0A" +
        "✖ Invalid input: expected string, received undefined%0A  → at GH_TOKEN%0A" +
        "✖ must be a repository's owner/name, such as celery/celery%0A  → at GITHUB_REPOSITORY%0A" +
        "Set CLOUDFLARE_API_TOKEN to the Cloudflare API token that deploys the worker; " +
        "GH_TOKEN to a GitHub token, which in CI is the workflow's token; " +
        "and GITHUB_REPOSITORY to the repository as owner/name.\n",
    });
  });
});
