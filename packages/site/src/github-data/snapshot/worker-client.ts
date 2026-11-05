/**
 * @file The site's client of the worker. It fetches a route's reply within a
 * time limit, retries a failure a later attempt may pass, and parses the reply
 * with the contract, or fails with an error that says what went wrong, in the
 * worker's own words where the worker answered with an error, and when the
 * response asked to be retried, if it did. It fetches whole snapshots too:
 * complete or not at all for the build, and route by route for the browser,
 * which keeps a route's previous reply when fetching its new one fails.
 */

import { exponentialBackoffMs, retryAtOf } from "@nusnus/github-data/retries";
import {
  WORKER_FETCH_DEADLINE_MS,
  workerErrorSchema,
  type WorkerReply,
  WorkerReplyError,
  type WorkerRoute,
  type WorkerRouteName,
} from "@nusnus/github-data/routes";
import * as schema from "@nusnus/github-data/schema";

import { awaitSnapshot, type GitHubSnapshot, ROUTE_NAMES } from "./snapshot.ts";

/** Why fetching a route's reply failed. */
type ReplyFailure = WorkerFetchError | WorkerReplyError;

/**
 * A snapshot updated route by route: each route's new reply, or its previous
 * one where fetching the new one failed, and each failure, in route order.
 */
export interface SnapshotUpdate {
  readonly failures: readonly ReplyFailure[];
  readonly snapshot: GitHubSnapshot;
}

/**
 * The time a client keeps: the clock that reads a Retry-After, the random
 * source that spreads its retries, the limit on each attempt, and its pauses.
 */
export interface Timing {
  readonly now: () => Date;
  readonly random: () => number;
  readonly timeout: (ms: number) => AbortSignal;
  readonly wait: (ms: number) => Promise<void>;
}

/**
 * What a failed fetch holds besides its message: the error that caused it,
 * and the instant the worker's last response asked to be retried at, if it
 * named one.
 */
interface FetchFailureDetails {
  readonly cause?: unknown;
  readonly retryAt?: Date | undefined;
}

/**
 * Whether a later attempt may pass, and when: never, after a backoff, or after
 * the wait the response asked for.
 */
type Retry = "backoff" | "never" | { readonly afterMs: number };

export const SYSTEM_TIMING: Timing = {
  random: Math.random,
  now: () => new Date(),
  timeout: (ms) => AbortSignal.timeout(ms),
  wait: (ms) =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    }),
};

/**
 * Fetching from the worker failed: it could not be reached, did not answer in
 * time, answered with an error, or with something other than JSON. Where the
 * worker's last response named when to retry, `retryAt` holds that instant.
 */
export class WorkerFetchError extends Error {
  override name = "WorkerFetchError";
  readonly retryAt: Date | undefined;

  constructor(message: string, details: FetchFailureDetails = {}) {
    super(message, details);
    this.retryAt = details.retryAt;
  }
}

/** One failed attempt: why, what to do about it, and whether to retry. */
class FailedAttempt {
  readonly reason: string;
  readonly nextStep: string;
  readonly retry: Retry;
  readonly details: FetchFailureDetails;

  constructor(
    reason: string,
    nextStep: string,
    retry: Retry,
    details: FetchFailureDetails,
  ) {
    this.reason = reason;
    this.nextStep = nextStep;
    this.retry = retry;
    this.details = details;
  }
}

/**
 * Fetches the worker's replies, each parsed by the contract, alone or as a
 * snapshot, retrying a failure a later attempt may pass: a network failure, a
 * timeout, or a server error Cloudflare sent for the worker, after the wait
 * the response asks for, else after a backoff that doubles with each attempt,
 * with equal jitter. An error the worker sent itself is final, since the
 * worker retries GitHub on its own: it fails at once with the worker's message.
 */
export class WorkerClient {
  static readonly MAX_ATTEMPTS = 3;
  static readonly FIRST_BACKOFF_MS = 1000;
  // The worker answers from its cache within a second; with no reply cached,
  // it waits on GitHub up to its fetch deadline. Five seconds more cover its
  // cache reads before that fetch and the response's way back, well under a
  // second when healthy, with room for a slow network; an attempt unanswered
  // by then is not coming.
  static readonly ATTEMPT_TIMEOUT_MS = WORKER_FETCH_DEADLINE_MS + 5000;
  // The longest Retry-After the client waits out, so a retry stays within a
  // build's patience.
  static readonly MAX_RETRY_AFTER_MS = 30_000;
  static readonly TRANSIENT_STATUSES: ReadonlySet<number> = new Set([
    429, 500, 502, 503, 504,
  ]);

  readonly origin: URL;
  readonly #fetch: typeof fetch;
  readonly #timing: Timing;

  constructor(origin: URL, fetchFromNetwork: typeof fetch, timing: Timing) {
    this.origin = origin;
    this.#fetch = fetchFromNetwork;
    this.#timing = timing;
  }

  async fetchSnapshot(): Promise<GitHubSnapshot> {
    return await awaitSnapshot((route) => this.fetchReply(route));
  }

  async updateSnapshot(previous: GitHubSnapshot): Promise<SnapshotUpdate> {
    const failed = new Map<WorkerRouteName, ReplyFailure>();
    const snapshot = await awaitSnapshot(async (route, name) => {
      try {
        return await this.fetchReply(route);
      } catch (error) {
        if (!isReplyFailure(error)) {
          throw error;
        }
        failed.set(name, error);
        return previous[name];
      }
    });
    return {
      failures: ROUTE_NAMES.flatMap((name) => failed.get(name) ?? []),
      snapshot,
    };
  }

  async fetchReply<Data>(route: WorkerRoute<Data>): Promise<WorkerReply<Data>> {
    const url = route.urlAt(this.origin);
    for (let attempt = 1; ; attempt += 1) {
      const received = await this.#attempt(url);
      if (!(received instanceof FailedAttempt)) {
        return route.parseReply(received);
      }
      if (received.retry === "never" || attempt === WorkerClient.MAX_ATTEMPTS) {
        const attempts =
          attempt === 1 ? "" : `, on each of ${String(attempt)} attempts`;
        throw new WorkerFetchError(
          `${received.reason}${attempts}; ${received.nextStep}`,
          received.details,
        );
      }
      await this.#timing.wait(
        received.retry === "backoff"
          ? exponentialBackoffMs(
              WorkerClient.FIRST_BACKOFF_MS,
              attempt,
              this.#timing.random,
            )
          : received.retry.afterMs,
      );
    }
  }

  async #attempt(url: URL): Promise<unknown> {
    const timeout = this.#timing.timeout(WorkerClient.ATTEMPT_TIMEOUT_MS);
    try {
      const response = await this.#fetch(url, { signal: timeout });
      if (!response.ok) {
        return this.#statusFailure(url, response, await response.text());
      }
      return await response.json();
    } catch (error) {
      return failedAttempt(url, error, timeout);
    }
  }

  #statusFailure(url: URL, response: Response, body: string): FailedAttempt {
    const reason = `The worker answered ${url.href} with HTTP ${String(response.status)}`;
    const receivedAt = this.#timing.now();
    // The worker's 502 names when it asks GitHub again, and Cloudflare sends a
    // Retry-After with the errors it answers for a worker that a retry may
    // pass: https://developers.cloudflare.com/changelog/post/2026-03-12-retry-after-header-for-1xxx-errors/
    const retryAfter = response.headers.get("Retry-After");
    const retryAt =
      // retryAtOf reads a missing header, null, as no instant too, so no test
      // tells this check from its absence; it serves the type checker.
      // Stryker disable next-line ConditionalExpression
      retryAfter === null ? undefined : retryAtOf(retryAfter, receivedAt);
    const details = { retryAt };
    const workerMessage = workerMessageOf(body);
    if (workerMessage !== undefined) {
      return new FailedAttempt(
        reason,
        `it says: ${workerMessage}`,
        "never",
        details,
      );
    }
    if (!WorkerClient.TRANSIENT_STATUSES.has(response.status)) {
      return new FailedAttempt(reason, "check its logs.", "never", details);
    }
    if (retryAfter === null) {
      return new FailedAttempt(reason, "check its logs.", "backoff", details);
    }
    if (retryAt === undefined) {
      return new FailedAttempt(
        reason,
        `its Retry-After, "${retryAfter}", is neither seconds nor a date; try again later.`,
        "never",
        details,
      );
    }
    const afterMs = Math.max(0, retryAt.getTime() - receivedAt.getTime());
    if (afterMs > WorkerClient.MAX_RETRY_AFTER_MS) {
      return new FailedAttempt(
        reason,
        `it asks to be retried in ${String(Math.ceil(afterMs / 1000))} seconds, longer than the client waits; try again then.`,
        "never",
        details,
      );
    }
    return new FailedAttempt(reason, "check its logs.", { afterMs }, details);
  }
}

// The worker's error responses hold its message, which says what failed and
// what to do. A response in another shape is Cloudflare's, sent when the
// worker could not answer.
function workerMessageOf(body: string): string | undefined {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    // A body that is not JSON is Cloudflare's; it leaves no JSON, which the
    // worker's error schema refuses.
  }
  return schema.parseOrUndefined(workerErrorSchema, json)?.error;
}

// fetch rejects with a TypeError when the network fails, and with its signal's
// reason when that aborts: https://fetch.spec.whatwg.org/#fetch-method
function failedAttempt(
  url: URL,
  error: unknown,
  timeout: AbortSignal,
): FailedAttempt {
  if (timeout.aborted && error === timeout.reason) {
    return new FailedAttempt(
      `The worker did not answer ${url.href} within ${String(WorkerClient.ATTEMPT_TIMEOUT_MS / 1000)} seconds`,
      "check that it is up.",
      "backoff",
      { cause: error },
    );
  }
  if (error instanceof SyntaxError) {
    return new FailedAttempt(
      `The worker's reply from ${url.href} is not JSON`,
      "check that the URL points at the worker.",
      "never",
      { cause: error },
    );
  }
  if (error instanceof TypeError) {
    return new FailedAttempt(
      `Could not reach the worker at ${url.href}: ${String(error)}`,
      "check that it is up and the network is.",
      "backoff",
      { cause: error },
    );
  }
  throw error;
}

function isReplyFailure(value: unknown): value is ReplyFailure {
  return value instanceof WorkerFetchError || value instanceof WorkerReplyError;
}
