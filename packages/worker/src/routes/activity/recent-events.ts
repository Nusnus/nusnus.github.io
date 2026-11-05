/**
 * @file Recent events: of the latest events GitHub lists for Tomer, the ones
 * the activity reply holds, those of the event types the contract holds,
 * newest first, since GitHub documents no order for them, up to the activity
 * feed's limit, each named with its target or, in a repository off the
 * allowlist, redacted; the event types it skips; and, once the titles the
 * Events API lacks are known, the reply's events, without any event whose pull
 * request or commit GitHub no longer has, which leaves the reply that much
 * short of the limit.
 */

import type { GitHubUrl } from "@nusnus/github-data/github-links";

import {
  type ActivityEvent,
  type EventType,
  isEventType,
  RECENT_ACTIVITY_LIMIT,
} from "@nusnus/github-data/activity";
import { isAllowlisted, redactedUrl } from "@nusnus/github-data/redaction";
import * as schema from "@nusnus/github-data/schema";

import {
  type ActivityTarget,
  type GitHubEvent,
  githubEventSchema,
  readTarget,
  type TitlePageTarget,
} from "./event-targets.ts";

export const githubEventsSchema = schema.array(githubEventSchema);

/** An event the activity reply holds, named with its target or redacted. */
type RecentEvent =
  | {
      readonly event: GitHubEvent<EventType>;
      readonly redacted: false;
      readonly target: ActivityTarget;
    }
  | { readonly event: GitHubEvent<EventType>; readonly redacted: true };

/**
 * The events the activity reply holds, newest first, and the types of the
 * events it skipped, which the contract does not hold.
 */
export interface RecentEvents {
  readonly events: readonly RecentEvent[];
  readonly skippedTypes: readonly string[];
}

/**
 * The activity reply's events, and the pages of pull requests and commits that
 * GitHub no longer has, whose events it left out.
 */
export interface TitledEvents {
  readonly events: readonly ActivityEvent[];
  readonly missingPages: readonly GitHubUrl[];
}

export function recentEvents(events: readonly GitHubEvent[]): RecentEvents {
  return {
    events: events
      .flatMap((event) =>
        isEventType(event.type) ? [{ ...event, type: event.type }] : [],
      )
      .toSorted(
        (first, second) =>
          second.created_at.getTime() - first.created_at.getTime(),
      )
      .slice(0, RECENT_ACTIVITY_LIMIT)
      .map((event) =>
        isAllowlisted(event.repo.name)
          ? { event, redacted: false, target: readTarget(event) }
          : { event, redacted: true },
      ),
    skippedTypes: events
      .map(({ type }) => type)
      .filter((type) => !isEventType(type)),
  };
}

export function titlePageTargets({ events }: RecentEvents): TitlePageTarget[] {
  return events.flatMap((recent) =>
    !recent.redacted && "titlePageUrl" in recent.target ? [recent.target] : [],
  );
}

export function titledEvents(
  recent: RecentEvents,
  titles: ReadonlyMap<GitHubUrl, string>,
): TitledEvents {
  return {
    events: recent.events.flatMap((recentEvent): ActivityEvent[] => {
      const fields = {
        createdAt: recentEvent.event.created_at,
        id: recentEvent.event.id,
        type: recentEvent.event.type,
      };
      if (recentEvent.redacted) {
        return [
          {
            ...fields,
            redacted: true,
            url: redactedUrl(recentEvent.event.repo.name),
          },
        ];
      }
      const { target } = recentEvent;
      const title =
        "title" in target ? target.title : titles.get(target.titlePageUrl);
      return title === undefined
        ? []
        : [
            {
              ...fields,
              redacted: false,
              repository: recentEvent.event.repo.name,
              title,
              url: target.url,
            },
          ];
    }),
    missingPages: [
      ...new Set(
        titlePageTargets(recent)
          .map(({ titlePageUrl }) => titlePageUrl)
          .filter((url) => !titles.has(url)),
      ),
    ],
  };
}
