/**
 * @file Calendar date arithmetic and formatting: whole days from one date to
 * another, across months, years and daylight saving changes, and negative
 * back in time; and each format a date or a weekday is shown in, all free of
 * the local time zone.
 */

import { describe, expect, it } from "vitest";

import {
  daysFrom,
  formatIsoDate,
  formatLongDate,
  formatShortMonth,
  formatShortMonthOfYear,
  formatShortWeekday,
} from "../../../../src/github-data/time/calendar-date.ts";

describe("daysFrom", () => {
  it.each([
    [{ day: 3, month: 11, year: 2026 }, { day: 4, month: 11, year: 2026 }, 1],
    [{ day: 31, month: 12, year: 2025 }, { day: 1, month: 1, year: 2026 }, 1],
    [{ day: 28, month: 3, year: 2026 }, { day: 30, month: 3, year: 2026 }, 2],
    [{ day: 4, month: 11, year: 2025 }, { day: 4, month: 11, year: 2026 }, 365],
    [{ day: 4, month: 11, year: 2026 }, { day: 4, month: 11, year: 2026 }, 0],
    [{ day: 5, month: 11, year: 2026 }, { day: 4, month: 11, year: 2026 }, -1],
  ])("from %o to %o is %i", (from, to, days) => {
    expect(daysFrom(from, to)).toBe(days);
  });
});

describe("formatIsoDate", () => {
  it("writes the date as ISO 8601 does, with zero-padded month and day", () => {
    expect(formatIsoDate({ day: 3, month: 3, year: 2026 })).toBe("2026-03-03");
  });
});

describe("formatLongDate", () => {
  it("writes the date in words", () => {
    expect(formatLongDate({ day: 3, month: 3, year: 2026 })).toBe(
      "March 3, 2026",
    );
  });
});

describe("formatShortMonthOfYear", () => {
  it.each([
    [{ day: 30, month: 11, year: 2025 }, "Nov ’25"],
    [{ day: 1, month: 1, year: 2005 }, "Jan ’05"],
  ])("abbreviates %o's month and year as %s", (date, text) => {
    expect(formatShortMonthOfYear(date)).toBe(text);
  });
});

describe("formatShortMonth", () => {
  it("abbreviates the date's month", () => {
    expect(formatShortMonth({ day: 30, month: 11, year: 2025 })).toBe("Nov");
  });
});

describe("formatShortWeekday", () => {
  it.each([
    [0, "Sun"],
    [1, "Mon"],
    [6, "Sat"],
  ] as const)("abbreviates weekday %i as %s", (weekday, text) => {
    expect(formatShortWeekday(weekday)).toBe(text);
  });
});
