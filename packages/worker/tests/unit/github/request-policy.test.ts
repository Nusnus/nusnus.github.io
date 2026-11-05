/**
 * @file The request policy: an attempt lasts its timeout, or what is left of
 * the deadline, and none starts once the deadline has passed; a transient
 * failure or a rate limit is retried within the attempt limit and the
 * deadline, after the wait GitHub asks for or a growing backoff, and every
 * other failure is not.
 */

import { describe, expect, it } from "vitest";

import { GitHubError } from "../../../src/github/failures.ts";
import { RequestPolicy } from "../../../src/github/request-policy.ts";

const POLICY = new RequestPolicy({
  attemptTimeoutMs: 10_000,
  firstBackoffMs: 1000,
  maxAttempts: 3,
});
const NOW = new Date("2026-11-04T07:20:00Z");
const DEADLINE = new Date("2026-11-04T07:20:25Z");
const SERVER_ERROR = GitHubError.transient("GitHub answered with 503.");

function after(ms: number): Date {
  return new Date(NOW.getTime() + ms);
}

describe("RequestPolicy.DEFAULT", () => {
  it("tries thrice, each attempt for GitHub's 10 seconds, the first retry a second on", () => {
    expect(RequestPolicy.DEFAULT.limits).toStrictEqual({
      attemptTimeoutMs: 10_000,
      firstBackoffMs: 1000,
      maxAttempts: 3,
    });
  });
});

describe("RequestPolicy.attemptTimeoutMs", () => {
  it("gives an attempt its timeout while the deadline is further off", () => {
    expect(POLICY.attemptTimeoutMs(NOW, DEADLINE)).toBe(10_000);
  });

  it("gives an attempt what is left of the deadline", () => {
    expect(POLICY.attemptTimeoutMs(after(24_999), DEADLINE)).toBe(1);
  });

  it("gives no attempt once the deadline has come", () => {
    expect(POLICY.attemptTimeoutMs(after(25_000), DEADLINE)).toBeUndefined();
  });
});

describe("RequestPolicy.waitBeforeRetry", () => {
  it.each([
    [1, 750],
    [2, 1500],
  ])(
    "waits a growing backoff before retrying attempt %i of a transient failure",
    (attempt, waitMs) => {
      expect(
        POLICY.waitBeforeRetry(attempt, SERVER_ERROR, NOW, DEADLINE, () => 0.5),
      ).toBe(waitMs);
    },
  );

  it("retries no failure after the last attempt", () => {
    expect(
      POLICY.waitBeforeRetry(3, SERVER_ERROR, NOW, DEADLINE, () => 0.5),
    ).toBeUndefined();
  });

  it("waits exactly as long as GitHub asks", () => {
    expect(
      POLICY.waitBeforeRetry(
        1,
        GitHubError.rateLimited("GitHub limited the rate.", after(4000)),
        NOW,
        DEADLINE,
        () => 0.5,
      ),
    ).toBe(4000);
  });

  it("retries at once when the instant GitHub asked for has passed", () => {
    expect(
      POLICY.waitBeforeRetry(
        1,
        GitHubError.transient("GitHub answered with 503.", after(-1000)),
        NOW,
        DEADLINE,
        () => 0.5,
      ),
    ).toBe(0);
  });

  it("retries nothing whose wait would reach the deadline", () => {
    expect(
      POLICY.waitBeforeRetry(
        1,
        GitHubError.rateLimited("GitHub limited the rate.", DEADLINE),
        NOW,
        DEADLINE,
        () => 0.5,
      ),
    ).toBeUndefined();
  });

  it("retries a wait that ends just before the deadline", () => {
    expect(
      POLICY.waitBeforeRetry(
        1,
        GitHubError.rateLimited("GitHub limited the rate.", after(24_999)),
        NOW,
        DEADLINE,
        () => 0.5,
      ),
    ).toBe(24_999);
  });

  it.each([
    ["misshapen", GitHubError.misshapen("GitHub sent a list.")],
    ["not found", GitHubError.notFound("GitHub answered with 404.", "Fix it.")],
    ["refused", GitHubError.refused("GitHub answered with 401.", "Fix it.")],
  ])("retries no %s failure", (_kind, failure) => {
    expect(
      POLICY.waitBeforeRetry(1, failure, NOW, DEADLINE, () => 0.5),
    ).toBeUndefined();
  });
});
