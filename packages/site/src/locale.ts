/**
 * @file The site's locale, American English: the language of its pages, and
 * how it writes dates, ages and counts, such as a date written out in full,
 * "November 4, 2026". It has a module of its own, apart from the site's
 * identity in `site.ts`, so the modules that format times and counts need
 * nothing else of the site.
 */

export const SITE_LOCALE = "en-US";

// The site's dates are calendar dates, which it holds as their midnight in
// UTC, so it writes them in UTC to show the same day wherever it is built or
// read.
export const LONG_DATE = new Intl.DateTimeFormat(SITE_LOCALE, {
  dateStyle: "long",
  timeZone: "UTC",
});
