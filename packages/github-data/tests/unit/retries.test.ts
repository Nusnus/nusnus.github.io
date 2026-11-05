/**
 * @file Retries: a Retry-After of seconds or an IMF-fixdate read as the
 * instant to retry at, and anything else, an obsolete date form included,
 * refused; the wait until an instant written as whole seconds, never fewer
 * than none; and the backoff, half of its ceiling fixed and half random, and
 * the ceiling, doubling from attempt to attempt up to any cap.
 */

import { describe, expect, it } from "vitest";

import {
  backoffCeilingMs,
  exponentialBackoffMs,
  retryAfterOf,
  retryAtOf,
} from "../../src/retries.ts";

const RECEIVED_AT = new Date("2026-11-04T07:20:05Z");

describe("retryAtOf", () => {
  it.each([
    ["0", new Date("2026-11-04T07:20:05Z")],
    ["30", new Date("2026-11-04T07:20:35Z")],
    ["Wed, 04 Nov 2026 07:21:00 GMT", new Date("2026-11-04T07:21:00Z")],
  ])("reads Retry-After: %s as the instant %s", (retryAfter, retryAt) => {
    expect(retryAtOf(retryAfter, RECEIVED_AT)).toStrictEqual(retryAt);
  });

  it.each([
    "soon",
    "30s",
    "in 30",
    "2.5",
    "-30",
    "Thu, 04 Nov 2026 07:21:00 GMT",
    "Wed, 31 Feb 2026 07:21:00 GMT",
    "Wednesday, 04-Nov-26 07:21:00 GMT",
    "Wed Nov  4 07:21:00 2026",
  ])("refuses Retry-After: %s, neither seconds nor an IMF-fixdate", (value) => {
    expect(retryAtOf(value, RECEIVED_AT)).toBeUndefined();
  });
});

describe("retryAfterOf", () => {
  it.each([
    [new Date("2026-11-04T07:20:35Z"), "30"],
    [new Date("2026-11-04T07:20:35.001Z"), "31"],
    [new Date("2026-11-04T07:20:04Z"), "0"],
  ])("asks a client to wait until %s as %s seconds", (retryAt, retryAfter) => {
    expect(retryAfterOf(retryAt, RECEIVED_AT)).toBe(retryAfter);
  });
});

describe("exponentialBackoffMs", () => {
  it.each([
    [1, 0, 500],
    [1, 0.5, 750],
    [2, 0, 1000],
    [3, 0.5, 3000],
  ])(
    "waits, before attempt %i's retry with a random %d, %i ms",
    (attempt, random, waitMs) => {
      expect(exponentialBackoffMs(1000, attempt, () => random)).toBe(waitMs);
    },
  );

  it("doubles no further than its cap", () => {
    expect(exponentialBackoffMs(1000, 4, () => 0.5, 4000)).toBe(3000);
  });
});

describe("backoffCeilingMs", () => {
  it.each([
    [1, 1000],
    [2, 2000],
    [3, 4000],
  ])("is, before attempt %i's retry, %i ms", (attempt, ceilingMs) => {
    expect(backoffCeilingMs(1000, attempt)).toBe(ceilingMs);
  });

  it("doubles no further than its cap", () => {
    expect(backoffCeilingMs(1000, 4, 5000)).toBe(5000);
  });
});
