/**
 * @file The calendar the contract's dates live on: a calendar date, with no
 * time zone, held as its year, month and day, never as a string, so no code
 * can parse it as a UTC instant and read it back in another time zone a day
 * off; its UTC midnight and its weekday; and the length of a UTC day,
 * `DAY_MS`.
 */

import * as schema from "./schema.ts";

export const calendarDateSchema = schema.readonly(
  schema
    .strictObject({
      day: schema.int(),
      month: schema.int(),
      year: schema.int(),
    })
    .check(
      schema.refine(
        (date) => {
          const midnight = utcMidnight(date);
          return (
            midnight.getUTCMonth() === date.month - 1 &&
            midnight.getUTCDate() === date.day
          );
        },
        { error: "must be a real calendar date, with months from 1 to 12" },
      ),
    ),
);

/** A date on the calendar, in no time zone; `month` runs from 1 to 12. */
export type CalendarDate = schema.Infer<typeof calendarDateSchema>;

/**
 * A day of the week, as GitHub's contribution graph numbers it: 0 for Sunday
 * to 6 for Saturday.
 */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// Date's arithmetic counts no leap seconds, so every UTC day is 24 hours:
// https://tc39.es/ecma262/#sec-time-values-and-time-range
export const DAY_MS = 24 * 60 * 60 * 1000;

export function utcMidnight({ day, month, year }: CalendarDate): Date {
  // UTC has no offset, so its days are calendar days. `Date.UTC` counts months
  // from 0 and rolls a date that is not on the calendar into a real one.
  return new Date(Date.UTC(year, month - 1, day));
}

export function weekdayOf(date: CalendarDate): Weekday {
  // GitHub numbers the days as getUTCDay does, which TypeScript types as any
  // number.
  return utcMidnight(date).getUTCDay() as Weekday;
}
