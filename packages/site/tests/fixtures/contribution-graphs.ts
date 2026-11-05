/**
 * @file Contribution graphs built for a test from daily counts, shaped as the
 * worker serves them, calendar weeks from Sunday, oldest first, and parsed by
 * the contract.
 */

import {
  type CalendarDate,
  DAY_MS,
  utcMidnight,
} from "@nusnus/github-data/calendar";
import {
  type ContributionGraph,
  contributionGraphSchema,
} from "@nusnus/github-data/contribution-graph";
import { parse } from "@nusnus/github-data/schema";

export function contributionGraph(
  firstDay: CalendarDate,
  dailyCounts: readonly number[],
): ContributionGraph {
  const weeks: unknown[][] = [];
  let week: unknown[] = [];
  dailyCounts.forEach((contributionCount, index) => {
    const date = new Date(utcMidnight(firstDay).getTime() + index * DAY_MS);
    if (date.getUTCDay() === 0 && week.length > 0) {
      weeks.push(week);
      week = [];
    }
    week.push({
      contributionCount,
      date: {
        day: date.getUTCDate(),
        month: date.getUTCMonth() + 1,
        year: date.getUTCFullYear(),
      },
    });
  });
  if (week.length > 0) {
    weeks.push(week);
  }
  return parse(
    contributionGraphSchema,
    {
      totalCommits: 0,
      totalContributions: dailyCounts.reduce((sum, count) => sum + count, 0),
      totalIssues: 0,
      totalPullRequests: 0,
      totalReviews: 0,
      weeks,
    },
    (issues) =>
      new Error(
        `These daily counts make a contribution graph the contract refuses; give counts it accepts:\n${issues}`,
      ),
  );
}
