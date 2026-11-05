/**
 * @file How a request to GitHub fails: each failure is classified where it is
 * detected, as a `GitHubError` of one failure kind with its next step,
 * carrying the instant GitHub asked the worker to wait until, if it asked. A
 * failed response is classified by its status, headers and body; a reply is
 * parsed into the shape the worker reads, or fails as misshapen.
 *
 * A failure is transient when a later attempt may pass, such as GitHub's own
 * server error, a request that went unanswered, or a fetch whose deadline the
 * worker spent before its next request could start; rate limited when GitHub
 * asks the worker to wait; not found; refused, such as a token GitHub does not
 * accept; or misshapen, when a reply is not in the shape GitHub documents.
 * GitHub documents how it answers a request past a rate limit:
 * https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api#exceeding-the-rate-limit
 */

import { retryAtOf } from "@nusnus/github-data/retries";
import * as schema from "@nusnus/github-data/schema";

import { GITHUB_API_VERSION } from "./api-version.ts";

/** How a request to GitHub failed, as the module's docstring defines each. */
export type GitHubFailureKind =
  "misshapen" | "not found" | "rate limited" | "refused" | "transient";

/**
 * What GitHub sent back for a request that did not succeed: its status, its
 * headers and its body, as text.
 */
export interface FailedResponse {
  readonly body: string;
  readonly headers: Headers;
  readonly status: number;
}

/**
 * A GitHub request that failed, or a reply not in the shape GitHub documents:
 * its kind, a message that says what went wrong and what to do about it, and
 * the instant GitHub asked the worker to wait until, which a rate limit always
 * names.
 */
export class GitHubError extends Error {
  override name = "GitHubError";
  readonly kind: GitHubFailureKind;
  readonly retryAt: Date | undefined;

  private constructor(
    kind: GitHubFailureKind,
    message: string,
    retryAt?: Date,
  ) {
    super(message);
    this.kind = kind;
    this.retryAt = retryAt;
  }

  static deadlineSpent(problem: string): GitHubError {
    return new GitHubError(
      "transient",
      `${problem}\nFetch the route's data in fewer requests; the worker asks again later.`,
    );
  }

  static misshapen(problem: string): GitHubError {
    return new GitHubError(
      "misshapen",
      `${problem}\nUpdate the worker's schema of it to what GitHub documents under API version ${GITHUB_API_VERSION}.`,
    );
  }

  static notFound(problem: string, nextStep: string): GitHubError {
    return new GitHubError("not found", `${problem}\n${nextStep}`);
  }

  static rateLimited(problem: string, retryAt: Date): GitHubError {
    return new GitHubError(
      "rate limited",
      `${problem}\nGitHub allows requests again at ${retryAt.toISOString()}.`,
      retryAt,
    );
  }

  static refused(problem: string, nextStep: string): GitHubError {
    return new GitHubError("refused", `${problem}\n${nextStep}`);
  }

  static transient(problem: string, retryAt?: Date): GitHubError {
    return new GitHubError(
      "transient",
      `${problem}\nhttps://www.githubstatus.com shows whether GitHub is down; the worker asks again later.`,
      retryAt,
    );
  }
}

// GitHub's server errors, which a later attempt may pass.
const SERVER_ERROR_STATUSES: ReadonlySet<number> = new Set([
  500, 502, 503, 504,
]);

// GitHub answers a request past a secondary rate limit with 403 or 429 and a
// message that names the limit, and asks a client sent neither header to wait
// a minute: https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api#exceeding-the-rate-limit
const RATE_LIMIT_MESSAGE = /rate limit/i;
const UNTIMED_RATE_LIMIT_WAIT_MS = 60_000;

export function parseGitHubData<Data>(
  subject: string,
  dataSchema: schema.Schema<Data>,
  json: unknown,
): Data {
  return schema.parse(dataSchema, json, (issues) =>
    GitHubError.misshapen(
      `GitHub's ${subject} is not in the shape the worker reads:\n${issues}`,
    ),
  );
}

export function parseJsonBody(
  requestLine: string,
  status: number,
  body: string,
): unknown {
  try {
    return JSON.parse(body);
  } catch {
    // JSON.parse throws nothing but a SyntaxError, for text that is not JSON.
    throw GitHubError.misshapen(
      `GitHub answered ${requestLine} with ${String(status)} and ${body === "" ? "no body" : `a body that is not JSON: ${body}`}`,
    );
  }
}

export function failureOf(
  requestLine: string,
  { body, headers, status }: FailedResponse,
  receivedAt: Date,
  nextStepIfNotFound: string,
): GitHubError {
  const problem = `GitHub answered ${requestLine} with ${String(status)}: ${body}`;
  const retryAfter = headers.get("Retry-After");
  if (SERVER_ERROR_STATUSES.has(status)) {
    return GitHubError.transient(
      problem,
      retryAfter === null
        ? undefined
        : parseRetryAfter(requestLine, retryAfter, receivedAt),
    );
  }
  if (status === 403 || status === 429) {
    if (retryAfter !== null) {
      return GitHubError.rateLimited(
        problem,
        parseRetryAfter(requestLine, retryAfter, receivedAt),
      );
    }
    if (headers.get("X-RateLimit-Remaining") === "0") {
      return GitHubError.rateLimited(
        problem,
        parseRateLimitReset(requestLine, headers.get("X-RateLimit-Reset")),
      );
    }
    if (status === 429 || RATE_LIMIT_MESSAGE.test(body)) {
      return GitHubError.rateLimited(
        problem,
        new Date(receivedAt.getTime() + UNTIMED_RATE_LIMIT_WAIT_MS),
      );
    }
  }
  if (status === 401) {
    return GitHubError.refused(
      problem,
      "Store a valid token in the worker's GITHUB_TOKEN secret.",
    );
  }
  if (status === 404) {
    return GitHubError.notFound(problem, nextStepIfNotFound);
  }
  return GitHubError.refused(
    problem,
    "Fix the request, or the token's access, as GitHub's message says.",
  );
}

function parseRetryAfter(
  requestLine: string,
  value: string,
  receivedAt: Date,
): Date {
  const retryAt = retryAtOf(value, receivedAt);
  if (retryAt === undefined) {
    throw GitHubError.misshapen(
      `GitHub's Retry-After header for ${requestLine} is neither seconds nor an IMF-fixdate: ${value}`,
    );
  }
  return retryAt;
}

// GitHub sends the rate limit's reset as seconds since the Unix epoch:
// https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api#checking-the-status-of-your-rate-limit
function parseRateLimitReset(requestLine: string, value: null | string): Date {
  if (!/^\d+$/.test(String(value))) {
    throw GitHubError.misshapen(
      `GitHub's X-RateLimit-Reset header for ${requestLine} is not seconds since the Unix epoch: ${String(value)}`,
    );
  }
  return new Date(Number(value) * 1000);
}
