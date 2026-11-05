/**
 * @file The request policy: how long one attempt at a GitHub request may take,
 * so every request of a fetch ends by the fetch's deadline, and whether to
 * retry a failed attempt, and after how long.
 */

import { exponentialBackoffMs } from "@nusnus/github-data/retries";

import type { GitHubError, GitHubFailureKind } from "./failures.ts";

/**
 * A request policy's limits on attempts, on each attempt's time and on waits.
 */
export interface RequestLimits {
  readonly attemptTimeoutMs: number;
  readonly firstBackoffMs: number;
  readonly maxAttempts: number;
}

/**
 * Decides how long each attempt at a GitHub request may take, and whether and
 * after how long a failed attempt is retried: only a transient failure or a
 * rate limit is, within the attempt limit and the fetch's deadline, after the
 * wait GitHub asks for or else a backoff that grows with each attempt.
 */
export class RequestPolicy {
  // An attempt lasts as long as GitHub lets a request run, 10 seconds:
  // https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api#timeouts
  static readonly DEFAULT = new RequestPolicy({
    attemptTimeoutMs: 10_000,
    firstBackoffMs: 1000,
    maxAttempts: 3,
  });

  static readonly #RETRIES: Readonly<Record<GitHubFailureKind, boolean>> = {
    misshapen: false,
    "not found": false,
    "rate limited": true,
    refused: false,
    transient: true,
  };

  readonly limits: RequestLimits;

  constructor(limits: RequestLimits) {
    this.limits = limits;
  }

  attemptTimeoutMs(now: Date, deadlineAt: Date): number | undefined {
    const remainingMs = deadlineAt.getTime() - now.getTime();
    return remainingMs > 0
      ? Math.min(this.limits.attemptTimeoutMs, remainingMs)
      : undefined;
  }

  waitBeforeRetry(
    attempt: number,
    failure: GitHubError,
    now: Date,
    deadlineAt: Date,
    random: () => number,
  ): number | undefined {
    if (!RequestPolicy.#RETRIES[failure.kind]) {
      return undefined;
    }
    const waitMs =
      failure.retryAt === undefined
        ? exponentialBackoffMs(this.limits.firstBackoffMs, attempt, random)
        : Math.max(0, failure.retryAt.getTime() - now.getTime());
    return attempt < this.limits.maxAttempts &&
      now.getTime() + waitMs < deadlineAt.getTime()
      ? waitMs
      : undefined;
  }
}
