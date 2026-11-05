/**
 * @file Arithmetic and formatting for the contract's calendar dates, which hold
 * a day with no time zone, and their weekdays: each works on the date's UTC
 * midnight, where a day is always 24 hours, `DAY_MS`.
 */

import {
  type CalendarDate,
  DAY_MS,
  utcMidnight,
  type Weekday,
} from "@nusnus/github-data/calendar";

import { LONG_DATE, SITE_LOCALE } from "../../locale.ts";

// A Sunday, so each weekday, numbered from Sunday's 0, falls that many days
// after it.
const SUNDAY: CalendarDate = { day: 4, month: 1, year: 1970 };

const SHORT_MONTH = new Intl.DateTimeFormat(SITE_LOCALE, {
  month: "short",
  timeZone: "UTC",
});

const SHORT_WEEKDAY = new Intl.DateTimeFormat(SITE_LOCALE, {
  timeZone: "UTC",
  weekday: "short",
});

const SHORT_YEAR = new Intl.DateTimeFormat(SITE_LOCALE, {
  timeZone: "UTC",
  year: "2-digit",
});

export function daysFrom(from: CalendarDate, to: CalendarDate): number {
  return (utcMidnight(to).getTime() - utcMidnight(from).getTime()) / DAY_MS;
}

export function formatIsoDate(date: CalendarDate): string {
  return utcMidnight(date).toISOString().slice(0, "YYYY-MM-DD".length);
}

export function formatLongDate(date: CalendarDate): string {
  return LONG_DATE.format(utcMidnight(date));
}

export function formatShortMonthOfYear(date: CalendarDate): string {
  return `${formatShortMonth(date)} ’${SHORT_YEAR.format(utcMidnight(date))}`;
}

export function formatShortMonth(date: CalendarDate): string {
  return SHORT_MONTH.format(utcMidnight(date));
}

export function formatShortWeekday(weekday: Weekday): string {
  return SHORT_WEEKDAY.format(
    utcMidnight({ ...SUNDAY, day: SUNDAY.day + weekday }),
  );
}
