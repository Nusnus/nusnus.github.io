/**
 * @file Tomer's presence on GitHub, as the sidebar's presence dot shows it:
 * active when his newest event fell today, recent when it fell yesterday, and
 * away when it fell earlier or there is none, by the visitor's calendar. The
 * activity reply lists the newest event first.
 */

import type { ActivityEvent } from "@nusnus/github-data/activity";

import type { Clock } from "../../time/clock.ts";

import { daysFrom } from "../../time/calendar-date.ts";

/** Tomer's presence on GitHub: active today, recent yesterday, or away. */
export type Presence = "active" | "away" | "recent";

export function presence(
  events: readonly ActivityEvent[],
  clock: Clock,
): Presence {
  const [newest] = events;
  if (newest === undefined) {
    return "away";
  }
  const daysAgo = daysFrom(clock.dateOf(newest.createdAt), clock.today());
  if (daysAgo <= 0) {
    return "active";
  }
  return daysAgo === 1 ? "recent" : "away";
}
