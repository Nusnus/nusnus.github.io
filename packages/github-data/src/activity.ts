/**
 * @file Tomer's recent activity on GitHub: his latest events, newest first,
 * each either named, with its repository and the title and link of what it
 * acted on, or redacted, as `redaction.ts` decides; the event types GitHub
 * documents, which `isEventType` tells apart; and the rule every title
 * follows, that it is never empty.
 */

import { fullNameSchema, instantSchema } from "./formats.ts";
import {
  type GitHubUrl,
  githubUrlSchema,
  pullRequestUrl,
  repositoryUrl,
} from "./github-links.ts";
import { isAllowlisted } from "./redaction.ts";
import * as schema from "./schema.ts";

// Every event type GitHub's Events API documents, in its docs' order:
// https://docs.github.com/en/rest/using-the-rest-api/github-event-types
const EVENT_TYPES = [
  "CommitCommentEvent",
  "CreateEvent",
  "DeleteEvent",
  "DiscussionEvent",
  "ForkEvent",
  "GollumEvent",
  "IssueCommentEvent",
  "IssuesEvent",
  "MemberEvent",
  "PublicEvent",
  "PullRequestEvent",
  "PullRequestReviewEvent",
  "PullRequestReviewCommentEvent",
  "PushEvent",
  "ReleaseEvent",
  "WatchEvent",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

const PULL_REQUEST_TYPES: ReadonlySet<EventType> = new Set([
  "PullRequestEvent",
  "PullRequestReviewCommentEvent",
  "PullRequestReviewEvent",
]);

// A pull request's path in its repository, with any anchor to a review or
// comment on it.
const PULL_REQUEST_PATH = /^\/pull\/\d+(?:#.*)?$/;

// The site's activity feed shows this many events.
export const RECENT_ACTIVITY_LIMIT = 10;

export const titleSchema = schema.string().check(schema.minLength(1));

const eventFields = {
  createdAt: instantSchema,
  id: schema.string(),
  type: schema.enum(EVENT_TYPES),
};

const namedActivityEventSchema = schema.readonly(
  schema
    .strictObject({
      ...eventFields,
      repository: fullNameSchema.check(
        schema.refine(isAllowlisted, {
          error:
            "must be the owner/name of a repository whose owner is on the allowlist; redact the event otherwise",
        }),
      ),
      title: titleSchema,
      url: githubUrlSchema,
      redacted: schema.literal(false),
    })
    .check(
      schema.refine(
        ({ repository, type, url }) =>
          !PULL_REQUEST_TYPES.has(type) ||
          isPullRequestPage(url, repositoryUrl(repository)),
        {
          error: `must link to the pull request the event acted on, such as ${pullRequestUrl("celery/celery", 9000)}`,
          path: ["url"],
        },
      ),
    ),
);

/**
 * An event in a repository whose owner is on the allowlist, named with its
 * repository. Its title is that of what it acted on, such as a pull request's
 * or an issue's title, a commit message's first line, a release's name or a
 * branch's name, and its link opens that; an event on a pull request links to
 * the pull request, in the event's repository.
 */
type NamedActivityEvent = schema.Infer<typeof namedActivityEventSchema>;

const redactedActivityEventSchema = schema.readonly(
  schema.strictObject({
    ...eventFields,
    url: githubUrlSchema,
    redacted: schema.literal(true),
  }),
);

/**
 * An event in a repository whose owner is not on the allowlist, with its
 * repository and title withheld; it links to the owner's page, and the site
 * shows it as a private project.
 */
type RedactedActivityEvent = schema.Infer<typeof redactedActivityEventSchema>;

export const activitySchema = schema.readonly(
  schema
    .array(
      schema.discriminatedUnion("redacted", [
        namedActivityEventSchema,
        redactedActivityEventSchema,
      ]),
    )
    .check(
      schema.maxLength(RECENT_ACTIVITY_LIMIT),
      schema.refine(
        (events) =>
          events.every((event, index) => {
            const previous = events[index - 1];
            return (
              previous === undefined || event.createdAt <= previous.createdAt
            );
          }),
        { error: "must list the events newest first, by createdAt" },
      ),
    ),
);

/** One of Tomer's recent GitHub events. */
export type ActivityEvent = NamedActivityEvent | RedactedActivityEvent;

export function isEventType(type: string): type is EventType {
  return EVENT_TYPES.some((eventType) => eventType === type);
}

function isPullRequestPage(url: GitHubUrl, repository: GitHubUrl): boolean {
  return (
    url.startsWith(repository) &&
    PULL_REQUEST_PATH.test(url.slice(repository.length))
  );
}
