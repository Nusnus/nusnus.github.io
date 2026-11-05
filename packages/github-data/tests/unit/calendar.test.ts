/**
 * @file The contract's calendar: the day of the week each calendar date falls
 * on.
 */

import { describe, expect, it } from "vitest";

import { weekdayOf } from "../../src/calendar.ts";

describe("weekdayOf", () => {
  it.each([
    { date: { day: 1, month: 11, year: 2026 }, weekday: 0 },
    { date: { day: 4, month: 11, year: 2026 }, weekday: 3 },
    { date: { day: 7, month: 11, year: 2026 }, weekday: 6 },
  ])(
    "numbers $date.year-$date.month-$date.day's day of the week $weekday",
    ({ date, weekday }) => {
      expect(weekdayOf(date)).toBe(weekday);
    },
  );
});
