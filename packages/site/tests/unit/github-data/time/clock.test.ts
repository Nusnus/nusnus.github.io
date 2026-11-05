/**
 * @file The clock: which calendar day an instant falls on in its time zone, and
 * how long ago an instant was, in words, up to 30 days back and as a date
 * beyond.
 */

import { describe, expect, it } from "vitest";

import { Clock } from "../../../../src/github-data/time/clock.ts";

// 22:30 UTC on November 3: already November 4 in Jerusalem.
const LATE_EVENING_UTC = new Date("2026-11-03T22:30:00Z");

describe("Clock", () => {
  it.each([
    ["UTC", { day: 3, month: 11, year: 2026 }],
    ["Asia/Jerusalem", { day: 4, month: 11, year: 2026 }],
    ["America/Los_Angeles", { day: 3, month: 11, year: 2026 }],
  ])("in %s, is on its zone's calendar day", (timeZone, today) => {
    expect(new Clock(LATE_EVENING_UTC, timeZone).today()).toStrictEqual(today);
  });

  it("finds the calendar day of any instant in its zone", () => {
    const clock = new Clock(LATE_EVENING_UTC, "Asia/Jerusalem");

    expect(clock.dateOf(new Date("2025-12-31T22:00:00Z"))).toStrictEqual({
      day: 1,
      month: 1,
      year: 2026,
    });
  });

  describe("timeSince", () => {
    const clock = new Clock(new Date("2026-11-04T12:00:00Z"), "UTC");

    it.each([
      ["2026-11-04T12:00:00Z", "now"],
      ["2026-11-04T11:59:01Z", "59 seconds ago"],
      ["2026-11-04T11:59:00Z", "1 minute ago"],
      ["2026-11-04T11:01:00Z", "59 minutes ago"],
      ["2026-11-04T11:00:00Z", "1 hour ago"],
      ["2026-11-03T13:00:00Z", "23 hours ago"],
      ["2026-11-03T12:00:00Z", "yesterday"],
      ["2026-10-06T12:00:00Z", "29 days ago"],
      ["2026-11-04T12:05:00Z", "in 5 minutes"],
    ])("of %s is %s", (instant, words) => {
      expect(clock.timeSince(new Date(instant))).toBe(words);
    });

    it("of an instant 30 days back or more is its date in the clock's zone", () => {
      const jerusalem = new Clock(
        new Date("2026-11-04T12:00:00Z"),
        "Asia/Jerusalem",
      );

      expect([
        clock.timeSince(new Date("2026-10-05T12:00:00Z")),
        jerusalem.timeSince(new Date("2026-03-02T23:00:00Z")),
      ]).toStrictEqual(["October 5, 2026", "March 3, 2026"]);
    });
  });
});
