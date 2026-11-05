/**
 * @file The contribution streak: how many days in a row, up to today, Tomer
 * contributed on. Today counts once it has a contribution, so a streak that ran
 * to yesterday holds until today ends. Days the graph holds after the visitor's
 * today, as a graph from a time zone ahead of theirs can, count as today's.
 */

import type { CalendarDate } from "@nusnus/github-data/calendar";
import type { ContributionGraph } from "@nusnus/github-data/contribution-graph";

import { daysFrom } from "../time/calendar-date.ts";

export function contributionStreak(
  graph: ContributionGraph,
  today: CalendarDate,
): number {
  let streak = 0;
  for (const day of graph.weeks.flat().toReversed()) {
    const daysAgo = daysFrom(day.date, today);
    if (daysAgo > streak + 1) {
      break;
    }
    if (day.contributionCount > 0) {
      streak += 1;
    } else if (daysAgo > 0) {
      break;
    }
  }
  return streak;
}
