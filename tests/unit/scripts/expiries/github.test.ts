/**
 * @file The expiries GitHub sets, and what GitHub's API sends the check. A
 * reply of GitHub's is read through its schema; a spent rate limit fails,
 * saying the next run repeats the check; and a refused token fails, naming
 * GH_TOKEN. A token expiry the worker relays reads in either of GitHub's
 * formats; one in another format fails. The worker's token expires when its
 * expiry says, or never. GitHub's support for an API version, the worker's or
 * the default the check's own requests get, ends as long after GitHub releases
 * its successor as GitHub documents, or never while it is the newest; a
 * version GitHub dropped fails. Each of Renovate's updates, and no one else's
 * pull request, counts as stuck once it has stayed open past the project's
 * limit.
 */

import type { Exchange } from "@nusnus/github-data/fixtures/exchange";

import { describe, expect, it } from "vitest";

import { ExpiryCheckError } from "../../../../scripts/expiries/expiry.ts";
import {
  apiVersionExpiry,
  defaultApiVersionExpiry,
  githubPullRequestsSchema,
  githubSupportedVersionsSchema,
  parseGitHubReply,
  parseTokenExpiry,
  stuckUpdateExpiries,
  workerTokenExpiry,
} from "../../../../scripts/expiries/github.ts";
import { receivedFrom, recorded } from "../../../fixtures/services/network.ts";

const VERSIONS = ["2026-03-10", "2022-11-28"];
const RATE_LIMITED = recorded("github/versions.rate-limited");
const RATE_LIMITED_BODY =
  '{"message":"API rate limit exceeded for 203.0.113.7. (But here\'s the good news: Authenticated requests get a higher rate limit. Check out the documentation for more details.)",' +
  '"documentation_url":"https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting"}';

describe("parseGitHubReply", () => {
  it("reads a reply through its schema", () => {
    expect(
      parseGitHubReply(
        receivedFrom(recorded("github/versions")),
        githubSupportedVersionsSchema,
      ),
    ).toStrictEqual(["2026-03-10", "2022-11-28"]);
  });

  it("reads the reply that spends a rate limit's last request", () => {
    expect(
      parseGitHubReply(
        receivedFrom(recorded("github/versions.last-request")),
        githubSupportedVersionsSchema,
      ),
    ).toStrictEqual(["2026-03-10", "2022-11-28"]);
  });

  it("refuses a reply to a spent rate limit, saying the next run repeats the check", () => {
    expect(() =>
      parseGitHubReply(
        receivedFrom(RATE_LIMITED),
        githubSupportedVersionsSchema,
      ),
    ).toThrow(
      new ExpiryCheckError(
        `GitHub rate-limited GH_TOKEN for GET https://api.github.com/versions with 403: ${RATE_LIMITED_BODY}\n` +
          "The next scheduled run repeats the check, once the limit has reset.",
      ),
    );
  });

  it.each([
    // GitHub answers a secondary rate limit with a wait, or with 429, and
    // neither can be caused on demand, so each edits the recorded reply to a
    // spent primary limit into one.
    {
      limit: "with a wait to retry after",
      reply: {
        ...RATE_LIMITED,
        headers: {
          ...RATE_LIMITED.headers,
          "retry-after": "60",
          "x-ratelimit-remaining": "59",
        },
      },
      refusal: `GitHub rate-limited GH_TOKEN for GET https://api.github.com/versions with 403: ${RATE_LIMITED_BODY}\nThe next scheduled run repeats the check, once the limit has reset.`,
    },
    {
      limit: "with 429",
      reply: {
        ...RATE_LIMITED,
        headers: { ...RATE_LIMITED.headers, "x-ratelimit-remaining": "59" },
        status: 429,
      },
      refusal: `GitHub rate-limited GH_TOKEN for GET https://api.github.com/versions with 429: ${RATE_LIMITED_BODY}\nThe next scheduled run repeats the check, once the limit has reset.`,
    },
  ] satisfies { limit: string; reply: Exchange; refusal: string }[])(
    "refuses a reply to a secondary rate limit $limit, saying the next run repeats the check",
    ({ refusal, reply }) => {
      expect(() =>
        parseGitHubReply(receivedFrom(reply), githubSupportedVersionsSchema),
      ).toThrow(new ExpiryCheckError(refusal));
    },
  );

  it.each([
    {
      name: "github/versions.unauthorized",
      refusal:
        "GitHub refused GH_TOKEN for GET https://api.github.com/versions with 401: " +
        '{"message":"Bad credentials","documentation_url":"https://docs.github.com/rest","status":"401"}\n' +
        "In CI, GH_TOKEN is the workflow's token: give the job in check-expiries.yml the permission this request needs. " +
        "Elsewhere, set GH_TOKEN to a token of yours, such as `gh auth token` prints.",
    },
    {
      name: "github/collaborators-of-unjs-c12.forbidden",
      refusal:
        "GitHub refused GH_TOKEN for GET https://api.github.com/repos/unjs/c12/collaborators with 403: " +
        '{"message":"Must have push access to view repository collaborators.",' +
        '"documentation_url":"https://docs.github.com/rest/collaborators/collaborators#list-repository-collaborators","status":"403"}\n' +
        "In CI, GH_TOKEN is the workflow's token: give the job in check-expiries.yml the permission this request needs. " +
        "Elsewhere, set GH_TOKEN to a token of yours, such as `gh auth token` prints.",
    },
  ])(
    "refuses the token GitHub refuses in $name, naming GH_TOKEN",
    ({ name, refusal }) => {
      expect(() =>
        parseGitHubReply(
          receivedFrom(recorded(name)),
          githubSupportedVersionsSchema,
        ),
      ).toThrow(new ExpiryCheckError(refusal));
    },
  );
});

describe("parseTokenExpiry", () => {
  it.each([
    ["2023-04-26 23:23:18 +0200", new Date("2023-04-26T21:23:18Z")],
    ["2023-01-31 23:00:00 UTC", new Date("2023-01-31T23:00:00Z")],
    ["2027-01-15 08:00:00 -0530", new Date("2027-01-15T13:30:00Z")],
  ])("reads %s as the instant it names", (header, instant) => {
    expect(parseTokenExpiry(header)).toStrictEqual(instant);
  });

  it.each([
    [
      "2023-04-26T21:23:18Z",
      'The worker relayed a token expiry that is not in GitHub\'s format: "2023-04-26T21:23:18Z". Teach parseTokenExpiry the format GitHub sends now.',
    ],
    [
      "2023-04-26 23:23:18 CEST",
      'The worker relayed a token expiry that is not in GitHub\'s format: "2023-04-26 23:23:18 CEST". Teach parseTokenExpiry the format GitHub sends now.',
    ],
    [
      "2023-13-26 23:23:18 UTC",
      'The worker relayed a token expiry that is not in GitHub\'s format: "2023-13-26 23:23:18 UTC". Teach parseTokenExpiry the format GitHub sends now.',
    ],
    [
      "2023-04-26 23:23 UTC",
      'The worker relayed a token expiry that is not in GitHub\'s format: "2023-04-26 23:23 UTC". Teach parseTokenExpiry the format GitHub sends now.',
    ],
    [
      "2023-04-26 23:23:18.5 UTC",
      'The worker relayed a token expiry that is not in GitHub\'s format: "2023-04-26 23:23:18.5 UTC". Teach parseTokenExpiry the format GitHub sends now.',
    ],
    [
      "x2023-04-26 23:23:18 UTC",
      'The worker relayed a token expiry that is not in GitHub\'s format: "x2023-04-26 23:23:18 UTC". Teach parseTokenExpiry the format GitHub sends now.',
    ],
    [
      "2023-04-26 23:23:18 UTC!",
      'The worker relayed a token expiry that is not in GitHub\'s format: "2023-04-26 23:23:18 UTC!". Teach parseTokenExpiry the format GitHub sends now.',
    ],
    [
      "on 2023-04-26 23:23:18 UTC",
      'The worker relayed a token expiry that is not in GitHub\'s format: "on 2023-04-26 23:23:18 UTC". Teach parseTokenExpiry the format GitHub sends now.',
    ],
    [
      "2023-04-26 23:23:18 UTC later",
      'The worker relayed a token expiry that is not in GitHub\'s format: "2023-04-26 23:23:18 UTC later". Teach parseTokenExpiry the format GitHub sends now.',
    ],
  ])("refuses %j, which is in no format of GitHub's", (header, refusal) => {
    expect(() => parseTokenExpiry(header)).toThrow(
      new ExpiryCheckError(refusal),
    );
  });
});

describe("workerTokenExpiry", () => {
  it("expires when the token does, saying how to renew it", () => {
    const expiry = workerTokenExpiry(new Date("2023-04-26T21:23:18Z"));

    expect([expiry.subject, expiry.expiresAt, expiry.renewal]).toStrictEqual([
      "The worker's GitHub token",
      new Date("2023-04-26T21:23:18Z"),
      "Create a token at https://github.com/settings/personal-access-tokens/new?name=nusnus.github.io%20worker&expires_in=none, " +
        "which reads public repositories and nothing else, then store it with " +
        "`cd packages/worker && bunx wrangler secret put GITHUB_TOKEN`.",
    ]);
  });

  it("never expires when the token never does", () => {
    expect(workerTokenExpiry("never").expiresAt).toBe("never");
  });
});

describe("apiVersionExpiry", () => {
  it("expires as long after GitHub released the worker's version's successor as GitHub supports a version, saying how to move the worker on", () => {
    const expiry = apiVersionExpiry("2022-11-28", VERSIONS);

    expect([expiry.subject, expiry.expiresAt, expiry.renewal]).toStrictEqual([
      "GitHub's support for API version 2022-11-28, which the worker requests,",
      new Date("2028-03-10T00:00:00Z"),
      "Move the worker to the newest version at https://docs.github.com/en/rest/about-the-rest-api/api-versions: " +
        "set the worker's GITHUB_API_VERSION, adapt the worker to the breaking changes at " +
        "https://docs.github.com/en/rest/about-the-rest-api/breaking-changes, then re-record its tests' exchanges with `GITHUB_TOKEN=$(gh auth token) bun run --filter @nusnus/worker record` " +
        "and the contract's worker replies with `bun run update:worker-replies`.",
    ]);
  });

  it("counts from the earliest of several successors", () => {
    expect(
      apiVersionExpiry("2022-11-28", ["2027-06-01", ...VERSIONS]).expiresAt,
    ).toStrictEqual(new Date("2028-03-10T00:00:00Z"));
  });

  it("never expires while it is the newest version", () => {
    expect(apiVersionExpiry("2026-03-10", VERSIONS).expiresAt).toBe("never");
  });

  it("refuses a version GitHub no longer supports, saying how to move the worker on", () => {
    expect(() => apiVersionExpiry("2021-01-01", VERSIONS)).toThrow(
      new ExpiryCheckError(
        "GitHub no longer supports API version 2021-01-01, which the worker requests. " +
          "Move the worker to the newest version at https://docs.github.com/en/rest/about-the-rest-api/api-versions: " +
          "set the worker's GITHUB_API_VERSION, adapt the worker to the breaking changes at " +
          "https://docs.github.com/en/rest/about-the-rest-api/breaking-changes, then re-record its tests' exchanges with `GITHUB_TOKEN=$(gh auth token) bun run --filter @nusnus/worker record` " +
          "and the contract's worker replies with `bun run update:worker-replies`.",
      ),
    );
  });
});

describe("defaultApiVersionExpiry", () => {
  it("expires as long after GitHub released the default version's successor as GitHub supports a version, saying how to name one", () => {
    const expiry = defaultApiVersionExpiry(VERSIONS);

    expect([expiry.subject, expiry.expiresAt, expiry.renewal]).toStrictEqual([
      "GitHub's support for API version 2022-11-28, the default the check's own requests get,",
      new Date("2028-03-10T00:00:00Z"),
      "Name the newest version at https://docs.github.com/en/rest/about-the-rest-api/api-versions in an X-GitHub-Api-Version header on the requests serviceRequest builds for GITHUB_API_ORIGIN, " +
        "adapt githubSupportedVersionsSchema and githubPullRequestsSchema to its breaking changes at " +
        "https://docs.github.com/en/rest/about-the-rest-api/breaking-changes, then record the services' exchanges again with `GH_TOKEN=$(gh auth token) bun run record:services`.",
    ]);
  });

  it("refuses the default version once GitHub no longer supports it, saying how to name a version", () => {
    expect(() => defaultApiVersionExpiry(["2026-03-10"])).toThrow(
      new ExpiryCheckError(
        "GitHub no longer supports API version 2022-11-28, the default the check's own requests get. " +
          "Name the newest version at https://docs.github.com/en/rest/about-the-rest-api/api-versions in an X-GitHub-Api-Version header on the requests serviceRequest builds for GITHUB_API_ORIGIN, " +
          "adapt githubSupportedVersionsSchema and githubPullRequestsSchema to its breaking changes at " +
          "https://docs.github.com/en/rest/about-the-rest-api/breaking-changes, then record the services' exchanges again with `GH_TOKEN=$(gh auth token) bun run record:services`.",
      ),
    );
  });
});

describe("stuckUpdateExpiries", () => {
  it("expires the stuck-update limit after each of Renovate's open pull requests opened, and no one else's, saying how to unstick it", () => {
    expect(
      stuckUpdateExpiries(
        parseGitHubReply(
          receivedFrom(recorded("github/pulls-of-unjs-c12")),
          githubPullRequestsSchema,
        ),
      ).map(({ expiresAt, renewal, subject }) => [subject, expiresAt, renewal]),
    ).toStrictEqual([
      [
        'Renovate\'s update in pull request #363, "chore(deps): update all non-major dependencies",',
        new Date("2027-01-28T02:55:56Z"),
        "Merge it, fixing what fails its checks, or close it: an update still open after 90 days has stopped landing on its own.",
      ],
      [
        'Renovate\'s update in pull request #364, "chore(deps): lock file maintenance",',
        new Date("2027-01-31T02:58:41Z"),
        "Merge it, fixing what fails its checks, or close it: an update still open after 90 days has stopped landing on its own.",
      ],
    ]);
  });
});
