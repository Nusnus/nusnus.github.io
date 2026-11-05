/**
 * @file The expiries GitHub sets: the worker's token; GitHub's support for the
 * API version the worker requests, and for the default version the check's
 * own requests get, each ending a fixed time after GitHub releases its
 * successor; and the time each of Renovate's updates may stay open before it
 * counts as stuck. It also reads what GitHub's API sends the check, its
 * supported versions and the repository's open pull requests, telling a rate
 * limit from a refused token, and the format of the token expiry the worker
 * relays from GitHub.
 */

import { DAY_MS } from "@nusnus/github-data/calendar";
import { type FullName, instantSchema } from "@nusnus/github-data/formats";
import {
  GITHUB_API_ORIGIN,
  personalAccessTokenUrl,
} from "@nusnus/github-data/github-links";
import * as schema from "@nusnus/github-data/schema";

import { Expiry, ExpiryCheckError } from "./expiry.ts";
import { NEXT_RUN, parseReply, type ReceivedResponse } from "./reply.ts";

const API_VERSIONS_URL =
  "https://docs.github.com/en/rest/about-the-rest-api/api-versions";

// The version GitHub answers a request that names none with, as the check's
// requests do: API_VERSIONS_URL, "Specifying an API version".
const DEFAULT_API_VERSION = "2022-11-28";

// GitHub names each version for the date it released it:
// https://docs.github.com/en/rest/meta/meta#get-all-api-versions
export const SUPPORTED_VERSIONS_URL = `${GITHUB_API_ORIGIN}/versions`;

export const githubSupportedVersionsSchema = schema.array(schema.iso.date());

export const githubPullRequestsSchema = schema.array(
  schema.object({
    created_at: instantSchema,
    number: schema.int(),
    title: schema.string(),
    user: schema.object({ login: schema.string() }),
  }),
);

// How long GitHub supports a version after it releases the next, at least:
// API_VERSIONS_URL, "Supported API versions".
const VERSION_SUPPORT_MONTHS = 24;

const WORKER_API_VERSION_RENEWAL =
  `Move the worker to the newest version at ${API_VERSIONS_URL}: ` +
  "set the worker's GITHUB_API_VERSION, adapt the worker to the breaking changes at " +
  "https://docs.github.com/en/rest/about-the-rest-api/breaking-changes, then re-record its tests' exchanges with `GITHUB_TOKEN=$(gh auth token) bun run --filter @nusnus/worker record` " +
  "and the contract's worker replies with `bun run update:worker-replies`.";

const DEFAULT_API_VERSION_RENEWAL =
  `Name the newest version at ${API_VERSIONS_URL} in an X-GitHub-Api-Version header on the requests serviceRequest builds for GITHUB_API_ORIGIN, ` +
  "adapt githubSupportedVersionsSchema and githubPullRequestsSchema to its breaking changes at " +
  "https://docs.github.com/en/rest/about-the-rest-api/breaking-changes, then record the services' exchanges again with `GH_TOKEN=$(gh auth token) bun run record:services`.";

// The project's own limit: Renovate keeps an update open as long as its checks
// fail, so one still open after this long needs a person.
const STUCK_UPDATE_DAYS = 90;

// The Mend-hosted Renovate app's account, which opens its pull requests.
const RENOVATE_LOGIN = "renovate[bot]";

// GitHub's docs name the token expiry header but not its format, which is as
// its users report it: a date, a time and a zone, in UTC or at an offset, such
// as `2023-01-31 23:00:00 UTC` or `2023-04-26 23:23:18 +0200`:
// https://github.com/google/go-github/issues/2649
const TOKEN_EXPIRY_PARTS = /^(\S+) (\S+) (\S+)$/;

export function openPullRequestsUrl(repository: FullName): string {
  // The oldest first, since a stuck update is old. A page holds at most 100,
  // so the check reads the 100 oldest open pull requests, and misses a stuck
  // update only while 100 older ones are open:
  // https://docs.github.com/en/rest/pulls/pulls#list-pull-requests
  return `${GITHUB_API_ORIGIN}/repos/${repository}/pulls?state=open&sort=created&direction=asc&per_page=100`;
}

export function parseGitHubReply<Reply>(
  response: ReceivedResponse,
  replySchema: schema.Schema<Reply>,
): Reply {
  // GitHub answers a spent rate limit with 403 or 429, and says so in these
  // headers, or with 429 alone:
  // https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api#exceeding-the-rate-limit
  if (
    response.status === 429 ||
    (response.status === 403 &&
      (response.headers.get("x-ratelimit-remaining") === "0" ||
        response.headers.has("retry-after")))
  ) {
    throw new ExpiryCheckError(
      `GitHub rate-limited GH_TOKEN for GET ${response.url} with ${String(response.status)}: ${response.body}\n` +
        `${NEXT_RUN}, once the limit has reset.`,
    );
  }
  if (response.status === 401 || response.status === 403) {
    throw new ExpiryCheckError(
      `GitHub refused GH_TOKEN for GET ${response.url} with ${String(response.status)}: ${response.body}\n` +
        "In CI, GH_TOKEN is the workflow's token: give the job in check-expiries.yml the permission this request needs. " +
        "Elsewhere, set GH_TOKEN to a token of yours, such as `gh auth token` prints.",
    );
  }
  return parseReply(response, replySchema);
}

export function parseTokenExpiry(header: string): Date {
  return new Date(
    schema.parse(
      // ISO 8601's check, to the second, refuses a date, time or offset in any
      // other form, or off the calendar or the clock.
      schema.iso.datetime({ offset: true, precision: 0 }),
      isoInstantOf(header),
      () =>
        new ExpiryCheckError(
          `The worker relayed a token expiry that is not in GitHub's format: "${header}". ` +
            "Teach parseTokenExpiry the format GitHub sends now.",
        ),
    ),
  );
}

export function workerTokenExpiry(expiresAt: "never" | Date): Expiry {
  return new Expiry(
    "The worker's GitHub token",
    expiresAt,
    `Create a token at ${personalAccessTokenUrl("nusnus.github.io worker", "none")}, ` +
      "which reads public repositories and nothing else, then store it with " +
      "`cd packages/worker && bunx wrangler secret put GITHUB_TOKEN`.",
  );
}

export function apiVersionExpiry(
  version: string,
  supportedVersions: readonly string[],
): Expiry {
  return versionSupport(
    version,
    "which the worker requests",
    supportedVersions,
    WORKER_API_VERSION_RENEWAL,
  );
}

export function defaultApiVersionExpiry(
  supportedVersions: readonly string[],
): Expiry {
  return versionSupport(
    DEFAULT_API_VERSION,
    "the default the check's own requests get",
    supportedVersions,
    DEFAULT_API_VERSION_RENEWAL,
  );
}

export function stuckUpdateExpiries(
  pullRequests: schema.Infer<typeof githubPullRequestsSchema>,
): Expiry[] {
  return pullRequests
    .filter(({ user }) => user.login === RENOVATE_LOGIN)
    .map(
      ({ created_at, number, title }) =>
        new Expiry(
          `Renovate's update in pull request #${String(number)}, "${title}",`,
          new Date(created_at.getTime() + STUCK_UPDATE_DAYS * DAY_MS),
          "Merge it, fixing what fails its checks, or close it: " +
            `an update still open after ${String(STUCK_UPDATE_DAYS)} days has stopped landing on its own.`,
        ),
    );
}

function isoInstantOf(header: string): string | undefined {
  const parts = TOKEN_EXPIRY_PARTS.exec(header);
  if (parts === null) {
    return undefined;
  }
  // Each of the pattern's three groups is in every match.
  const date = String(parts[1]);
  const time = String(parts[2]);
  const zone = String(parts[3]);
  const offset = zone === "UTC" ? "Z" : `${zone.slice(0, 3)}:${zone.slice(3)}`;
  return `${date}T${time}${offset}`;
}

function versionSupport(
  version: string,
  role: string,
  supportedVersions: readonly string[],
  renewal: string,
): Expiry {
  if (!supportedVersions.includes(version)) {
    throw new ExpiryCheckError(
      `GitHub no longer supports API version ${version}, ${role}. ${renewal}`,
    );
  }
  const successor = supportedVersions
    .filter((supported) => supported > version)
    .toSorted()
    .at(0);
  return new Expiry(
    `GitHub's support for API version ${version}, ${role},`,
    successor === undefined ? "never" : supportEnd(successor),
    renewal,
  );
}

function supportEnd(successor: string): Date {
  // A date without a time reads as that day's midnight in UTC:
  // https://tc39.es/ecma262/#sec-date-time-string-format
  const end = new Date(successor);
  end.setUTCMonth(end.getUTCMonth() + VERSION_SUPPORT_MONTHS);
  return end;
}
