/**
 * @file Tomer's contribution graph: a year of daily contribution counts, each
 * day a calendar date, grouped in calendar weeks, and the year's totals.
 */

import { calendarDateSchema } from "./calendar.ts";
import { countSchema } from "./formats.ts";
import * as schema from "./schema.ts";

const contributionDaySchema = schema.readonly(
  schema.strictObject({
    contributionCount: countSchema,
    date: calendarDateSchema,
  }),
);

/** One day of the graph: its date and its contribution count. */
export type ContributionDay = schema.Infer<typeof contributionDaySchema>;

export const contributionGraphSchema = schema.readonly(
  schema.strictObject({
    totalCommits: countSchema,
    totalContributions: countSchema,
    totalIssues: countSchema,
    totalPullRequests: countSchema,
    totalReviews: countSchema,
    weeks: schema.readonly(
      schema.array(schema.readonly(schema.array(contributionDaySchema))),
    ),
  }),
);

/**
 * Tomer's contributions over the last year, as GitHub's contribution
 * calendar counts them: the days in weeks from Sunday to Saturday, oldest
 * first, where the first and last weeks may be partial.
 */
export type ContributionGraph = schema.Infer<typeof contributionGraphSchema>;
