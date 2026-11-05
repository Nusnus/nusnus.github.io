/**
 * @file The expiry check asks each service with its own token, reports when
 * each thing expires, and passes while none is due. It fails on each due
 * expiry, saying how to renew it, and on each it cannot learn, reporting each
 * failure once and every expiry the failure did not cost; a service out of
 * reach or silent past its deadline says the next run repeats the check.
 * Missing or invalid environment variables fail it before it asks anything,
 * and an error it does not expect escapes.
 */

import type { Exchange } from "@nusnus/github-data/fixtures/exchange";

import {
  profileExchange,
  profileUnavailableExchange,
} from "@nusnus/github-data/fixtures/worker-replies";
import { describe, expect, it, vi } from "vitest";

import { checkExpiries } from "../../../../scripts/expiries/check.ts";
import {
  breakBody,
  receivedRequests,
  recorded,
  replayServices,
  silence,
  unreachable,
  useFakeNetwork,
} from "../../../fixtures/services/network.ts";

useFakeNetwork();

const ENVIRONMENT_VARIABLES = {
  CLOUDFLARE_API_TOKEN: "cloudflare-token",
  GH_TOKEN: "github-token",
  GITHUB_REPOSITORY: "unjs/c12",
};
// A day before the Cloudflare reference example's token is due; nothing else
// is due for years.
const NOTHING_DUE = new Date("2019-12-01T00:00:00Z");
const EVERY_SERVICE = [
  profileExchange,
  recorded("github/versions"),
  recorded("cloudflare/verify-token-reference-example"),
  recorded("node/schedule"),
  recorded("github/pulls-of-unjs-c12"),
];
const WORKER_TOKEN_LINE =
  "The worker's GitHub token expires on 2023-04-26, in 1242 days.";
const API_VERSION_LINES = [
  "GitHub's support for API version 2026-03-10, which the worker requests, never expires.",
  "GitHub's support for API version 2022-11-28, the default the check's own requests get, expires on 2028-03-10, in 3022 days.",
];
const LINES_AFTER_GITHUB = [
  "The Cloudflare API token that deploys the worker expires on 2020-01-01, in 31 days.",
  "Node.js 26's support expires on 2029-04-30, in 3438 days.",
  'Renovate\'s update in pull request #363, "chore(deps): update all non-major dependencies", expires on 2027-01-28, in 2615 days.',
  'Renovate\'s update in pull request #364, "chore(deps): lock file maintenance", expires on 2027-01-31, in 2618 days.',
];

function replayEveryService(...replacements: readonly Exchange[]): void {
  const replaced = new Set(replacements.map(({ request }) => request.url));
  replayServices(
    ...replacements,
    ...EVERY_SERVICE.filter(({ request }) => !replaced.has(request.url)),
  );
}

describe("checkExpiries", () => {
  it("passes while nothing is due, reporting when each thing expires", async () => {
    replayEveryService();

    expect(
      await checkExpiries("26.13.0", ENVIRONMENT_VARIABLES, NOTHING_DUE),
    ).toStrictEqual({
      exitCode: 0,
      lines: [WORKER_TOKEN_LINE, ...API_VERSION_LINES, ...LINES_AFTER_GITHUB],
    });
  });

  it("asks each service with its own token", async () => {
    replayEveryService();

    await checkExpiries("26.13.0", ENVIRONMENT_VARIABLES, NOTHING_DUE);

    expect(
      receivedRequests()
        .map(({ headers, url }) => ({
          authorization: headers["authorization"],
          url,
        }))
        .toSorted((first, second) => first.url.localeCompare(second.url)),
    ).toStrictEqual([
      {
        authorization: undefined,
        url: "https://ai-proxy.tomer-nosrati.workers.dev/profile",
      },
      {
        authorization: "Bearer cloudflare-token",
        url: "https://api.cloudflare.com/client/v4/user/tokens/verify",
      },
      {
        authorization: "Bearer github-token",
        url: "https://api.github.com/repos/unjs/c12/pulls?state=open&sort=created&direction=asc&per_page=100",
      },
      {
        authorization: "Bearer github-token",
        url: "https://api.github.com/versions",
      },
      {
        authorization: undefined,
        url: "https://raw.githubusercontent.com/nodejs/Release/main/schedule.json",
      },
    ]);
  });

  it("gives each service 10 seconds to answer, failing it once they pass", async () => {
    replayEveryService();
    // The deadline's own error, which fetch rejects with once it passes:
    // https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static
    const deadline = vi
      .spyOn(AbortSignal, "timeout")
      .mockImplementation(() =>
        AbortSignal.abort(
          new DOMException(
            "The operation was aborted due to timeout",
            "TimeoutError",
          ),
        ),
      );

    const report = await checkExpiries(
      "26.13.0",
      ENVIRONMENT_VARIABLES,
      NOTHING_DUE,
    );

    expect({ calls: deadline.mock.calls, report }).toStrictEqual({
      calls: [[10_000], [10_000], [10_000], [10_000], [10_000]],
      report: {
        exitCode: 1,
        lines: [
          "::error::GET https://ai-proxy.tomer-nosrati.workers.dev/profile got no answer within 10 seconds. The next scheduled run repeats the check.",
          "::error::GET https://api.github.com/versions got no answer within 10 seconds. The next scheduled run repeats the check.",
          "::error::GET https://api.cloudflare.com/client/v4/user/tokens/verify got no answer within 10 seconds. The next scheduled run repeats the check.",
          "::error::GET https://raw.githubusercontent.com/nodejs/Release/main/schedule.json got no answer within 10 seconds. The next scheduled run repeats the check.",
          "::error::GET https://api.github.com/repos/unjs/c12/pulls?state=open&sort=created&direction=asc&per_page=100 got no answer within 10 seconds. The next scheduled run repeats the check.",
        ],
      },
    });
  });

  it("fails on each expiry that is due, saying how to renew it", async () => {
    replayEveryService();

    expect(
      await checkExpiries(
        "26.13.0",
        ENVIRONMENT_VARIABLES,
        new Date("2026-12-30T00:00:00Z"),
      ),
    ).toStrictEqual({
      exitCode: 1,
      lines: [
        "::error::The worker's GitHub token expired on 2023-04-26. " +
          "Create a token at https://github.com/settings/personal-access-tokens/new?name=nusnus.github.io%2520worker&expires_in=none, " +
          "which reads public repositories and nothing else, then store it with `cd packages/worker && bunx wrangler secret put GITHUB_TOKEN`.",
        "GitHub's support for API version 2026-03-10, which the worker requests, never expires.",
        "GitHub's support for API version 2022-11-28, the default the check's own requests get, expires on 2028-03-10, in 436 days.",
        "::error::The Cloudflare API token that deploys the worker expired on 2020-01-01. " +
          'Create a token from the "Edit Cloudflare Workers" template at https://dash.cloudflare.com/profile/api-tokens, ' +
          "or roll the current one there, then store it with `gh secret set CLOUDFLARE_API_TOKEN --env cloudflare`.",
        "Node.js 26's support expires on 2029-04-30, in 852 days.",
        '::error::Renovate\'s update in pull request #363, "chore(deps): update all non-major dependencies", expires on 2027-01-28, in 29 days. ' +
          "Merge it, fixing what fails its checks, or close it: an update still open after 90 days has stopped landing on its own.",
        'Renovate\'s update in pull request #364, "chore(deps): lock file maintenance", expires on 2027-01-31, in 32 days.',
      ],
    });
  });

  it("reports a failing worker once, losing only the expiries its reply holds", async () => {
    replayEveryService(profileUnavailableExchange);

    expect(
      await checkExpiries("26.13.0", ENVIRONMENT_VARIABLES, NOTHING_DUE),
    ).toStrictEqual({
      exitCode: 1,
      lines: [
        "::error::The worker answered GET https://ai-proxy.tomer-nosrati.workers.dev/profile with 502: " +
          '{"error":"GitHub data for /profile is unavailable, and the worker has no cached reply to serve: GitHub answered GET /users/Nusnus with 403: {\\"message\\":\\"API rate limit exceeded for 203.0.113.7. (But here\'s the good news: Authenticated requests get a higher rate limit. Check out the documentation for more details.)\\",\\"documentation_url\\":\\"https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting\\"}\\nGitHub allows requests again at 2026-11-04T08:20:04.000Z.\\nThe worker asks GitHub again at 2026-11-04T08:20:04.000Z."}%0A' +
          "It could not fetch GitHub's data and had no cached reply to serve. The next scheduled run repeats the check; " +
          "if the failure lasts, the worker's logs, in the Cloudflare dashboard's Workers & Pages, say why.",
        "GitHub's support for API version 2022-11-28, the default the check's own requests get, expires on 2028-03-10, in 3022 days.",
        ...LINES_AFTER_GITHUB,
      ],
    });
  });

  it("reports failing supported versions, losing only the API version's expiry", async () => {
    replayEveryService(recorded("github/versions.unauthorized"));

    expect(
      await checkExpiries("26.13.0", ENVIRONMENT_VARIABLES, NOTHING_DUE),
    ).toStrictEqual({
      exitCode: 1,
      lines: [
        WORKER_TOKEN_LINE,
        "::error::GitHub refused GH_TOKEN for GET https://api.github.com/versions with 401: " +
          '{"message":"Bad credentials","documentation_url":"https://docs.github.com/rest","status":"401"}%0A' +
          "In CI, GH_TOKEN is the workflow's token: give the job in check-expiries.yml the permission this request needs. " +
          "Elsewhere, set GH_TOKEN to a token of yours, such as `gh auth token` prints.",
        ...LINES_AFTER_GITHUB,
      ],
    });
  });

  it("fails on a service out of reach, or silent past its deadline, saying the next run repeats the check", async () => {
    replayEveryService();
    unreachable("https://api.github.com/versions");
    silence("https://api.cloudflare.com/client/v4/user/tokens/verify");

    expect(
      await checkExpiries("26.13.0", ENVIRONMENT_VARIABLES, NOTHING_DUE),
    ).toStrictEqual({
      exitCode: 1,
      lines: [
        WORKER_TOKEN_LINE,
        "::error::GET https://api.github.com/versions failed: TypeError: fetch failed. The next scheduled run repeats the check.",
        "::error::GET https://api.cloudflare.com/client/v4/user/tokens/verify got no answer within 10 seconds. The next scheduled run repeats the check.",
        "Node.js 26's support expires on 2029-04-30, in 3438 days.",
        'Renovate\'s update in pull request #363, "chore(deps): update all non-major dependencies", expires on 2027-01-28, in 2615 days.',
        'Renovate\'s update in pull request #364, "chore(deps): lock file maintenance", expires on 2027-01-31, in 2618 days.',
      ],
    });
  });

  it("fails before asking anything while its environment variables are missing or invalid", async () => {
    replayEveryService();

    expect([
      await checkExpiries(
        "26.13.0",
        { GH_TOKEN: "github-token", GITHUB_REPOSITORY: "c12" },
        NOTHING_DUE,
      ),
      receivedRequests(),
    ]).toStrictEqual([
      {
        exitCode: 1,
        lines: [
          "::error::The check's environment variables are missing or invalid:%0A" +
            "✖ Invalid input: expected string, received undefined%0A  → at CLOUDFLARE_API_TOKEN%0A" +
            "✖ must be a repository's owner/name, such as celery/celery%0A  → at GITHUB_REPOSITORY%0A" +
            "Set CLOUDFLARE_API_TOKEN to the Cloudflare API token that deploys the worker; " +
            "GH_TOKEN to a GitHub token, which in CI is the workflow's token; " +
            "and GITHUB_REPOSITORY to the repository as owner/name.",
        ],
      },
      [],
    ]);
  });

  it.each([
    new Error("the body broke"),
    new DOMException("The body was aborted", "AbortError"),
  ])("lets an error it does not expect, %s, escape", async (error) => {
    replayEveryService();
    breakBody(
      "https://raw.githubusercontent.com/nodejs/Release/main/schedule.json",
      error,
    );

    await expect(
      checkExpiries("26.13.0", ENVIRONMENT_VARIABLES, NOTHING_DUE),
    ).rejects.toBe(error);
  });
});
