/**
 * @file The clock that times on the page are read by: an instant, and the time
 * zone whose calendar says which day it falls on. The build renders the page by
 * a UTC clock stopped at the moment it baked the GitHub data in; the browser
 * reads the visitor's own clock and time zone.
 */

import { type CalendarDate, DAY_MS } from "@nusnus/github-data/calendar";

import { SITE_LOCALE } from "../../locale.ts";
import { formatLongDate } from "./calendar-date.ts";

/**
 * Reads times on the page by one instant, now, and the time zone whose calendar
 * dates it: which day an instant fell on, and how long ago, in words.
 */
export class Clock {
  static readonly SECOND_MS = 1000;
  static readonly MINUTE_MS = 60 * Clock.SECOND_MS;
  static readonly HOUR_MS = 60 * Clock.MINUTE_MS;
  // Further back than this, a time reads as its date rather than as an age.
  static readonly AGE_LIMIT_MS = 30 * DAY_MS;
  static readonly AGE = new Intl.RelativeTimeFormat(SITE_LOCALE, {
    numeric: "auto",
  });

  readonly now: Date;
  readonly #calendar: Intl.DateTimeFormat;

  constructor(now: Date, timeZone: string) {
    this.now = now;
    this.#calendar = new Intl.DateTimeFormat(SITE_LOCALE, {
      day: "numeric",
      month: "numeric",
      timeZone,
      year: "numeric",
    });
  }

  today(): CalendarDate {
    return this.dateOf(this.now);
  }

  dateOf(instant: Date): CalendarDate {
    // Intl names every part these options ask for, so every field is set
    // below and no input tells these placeholders apart.
    // Stryker disable next-line ObjectLiteral
    const date = { day: Number.NaN, month: Number.NaN, year: Number.NaN };
    for (const { type, value } of this.#calendar.formatToParts(instant)) {
      if (type === "day" || type === "month" || type === "year") {
        date[type] = Number(value);
      }
    }
    return date;
  }

  timeSince(then: Date): string {
    const elapsed = then.getTime() - this.now.getTime();
    const age = Math.abs(elapsed);
    if (age < Clock.MINUTE_MS) {
      return Clock.AGE.format(Math.round(elapsed / Clock.SECOND_MS), "second");
    }
    if (age < Clock.HOUR_MS) {
      return Clock.AGE.format(Math.round(elapsed / Clock.MINUTE_MS), "minute");
    }
    if (age < DAY_MS) {
      return Clock.AGE.format(Math.round(elapsed / Clock.HOUR_MS), "hour");
    }
    if (age < Clock.AGE_LIMIT_MS) {
      return Clock.AGE.format(Math.round(elapsed / DAY_MS), "day");
    }
    return formatLongDate(this.dateOf(then));
  }
}
