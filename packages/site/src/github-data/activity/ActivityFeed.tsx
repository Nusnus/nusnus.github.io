/**
 * @file The activity feed: Tomer's recent GitHub events, each a link to what it
 * acted on, with its type's icon, its title, and its repository, type and age
 * below; or a note when there are none. New rows slide in, one after another.
 * The default export is the live island.
 */

import type { ActivityEvent } from "@nusnus/github-data/activity";

import type { Clock } from "../time/clock.ts";

import { Activity } from "../../design-system/icons.ts";
import { linkTarget } from "../../design-system/link-target.ts";
import { liveIsland } from "../live/live-island.tsx";
import { displayEvent } from "./event-display.tsx";

const ROW_DELAY_MS = 50;

export function ActivityFeed({
  clock,
  events,
}: {
  clock: Clock;
  events: readonly ActivityEvent[];
}) {
  if (events.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-text-muted">
        <Activity className="mx-auto mb-2 h-6 w-6 opacity-50" />
        <p>No recent activity</p>
      </div>
    );
  }
  return (
    <ul aria-label="Recent GitHub activity" className="space-y-1">
      {events.map((event, index) => {
        const { icon, repositoryName, title, typeLabel } = displayEvent(event);
        return (
          <li key={event.id}>
            <a
              className="group flex gap-3 rounded-lg p-2.5 transition-colors duration-100 hover:bg-bg-surface active:bg-bg-surface/80 motion-safe:animate-slide-in-right motion-reduce:transition-none"
              href={event.url}
              style={{ animationDelay: `${String(index * ROW_DELAY_MS)}ms` }}
              {...linkTarget(event.url)}
            >
              {icon}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-text-primary group-hover:text-accent">
                  {title}
                </p>
                <p className="mt-0.5 flex items-center gap-2 text-xs text-text-muted">
                  <span className="font-mono">{repositoryName}</span>
                  <span aria-hidden="true">·</span>
                  <span>{typeLabel}</span>
                  <span aria-hidden="true">·</span>
                  <time dateTime={event.createdAt.toISOString()}>
                    {clock.timeSince(event.createdAt)}
                  </time>
                </p>
              </div>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export default liveIsland(ActivityFeed, ({ clock, snapshot }) => ({
  clock,
  events: snapshot.activity.data,
}));
