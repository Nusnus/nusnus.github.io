/**
 * @file The activity reply: at most the activity feed's worth of events, each
 * of a type GitHub documents, named ones titled and linked to what they acted
 * on (a pull request for pull request events), and the rest redacted; and which
 * event types GitHub documents.
 */

import { describe, expect, it } from "vitest";

import { isEventType, RECENT_ACTIVITY_LIMIT } from "../../src/activity.ts";
import { WORKER_ROUTES, WorkerReplyError } from "../../src/routes.ts";
import {
  activityReply,
  redactedActivityReply,
} from "../fixtures/worker-replies.ts";

const PULL_REQUEST_EVENT = recordedEventOfType("PullRequestEvent");

const [REDACTED_EVENT] = redactedActivityReply.data;

function recordedEventOfType(
  type: string,
): (typeof activityReply.data)[number] {
  const event = activityReply.data.find((candidate) => candidate.type === type);
  if (event === undefined) {
    throw new Error(`The worker's recorded activity reply holds no ${type}.`);
  }
  return event;
}

function parseEvents(...events: readonly unknown[]): unknown {
  return WORKER_ROUTES.activity.parseReply({ ...activityReply, data: events });
}

describe("RECENT_ACTIVITY_LIMIT", () => {
  it("is the ten events the site's activity feed shows", () => {
    expect(RECENT_ACTIVITY_LIMIT).toBe(10);
  });
});

describe("activity reply", () => {
  it("reads and writes back the worker's recorded reply as it was", () => {
    const route = WORKER_ROUTES.activity;

    expect(route.encodeReply(route.parseReply(activityReply))).toStrictEqual(
      activityReply,
    );
  });

  it("accepts named and redacted events", () => {
    const reply = {
      ...activityReply,
      data: [REDACTED_EVENT, PULL_REQUEST_EVENT],
    };
    const route = WORKER_ROUTES.activity;

    expect(route.encodeReply(route.parseReply(reply))).toStrictEqual(reply);
  });

  it("freezes its events and each named and redacted event", () => {
    const { data } = WORKER_ROUTES.activity.parseReply({
      ...activityReply,
      data: [REDACTED_EVENT, PULL_REQUEST_EVENT],
    });

    expect([data, data[0], data[1]].map(Object.isFrozen)).toStrictEqual([
      true,
      true,
      true,
    ]);
  });

  it("refuses more events than the limit", () => {
    expect(() =>
      parseEvents(...activityReply.data, PULL_REQUEST_EVENT),
    ).toThrow(
      new WorkerReplyError(
        "The worker's /activity reply breaks the github-data contract:\n" +
          "✖ Too big: expected array to have <=10 items\n" +
          "  → at data\n" +
          "Deploy the worker and the site from the same commit.",
      ),
    );
  });

  it("refuses events out of order", () => {
    expect(() =>
      parseEvents(
        { ...PULL_REQUEST_EVENT, createdAt: "2026-11-01T10:00:00.000Z" },
        { ...PULL_REQUEST_EVENT, createdAt: "2026-11-04T07:00:00.000Z" },
      ),
    ).toThrow(
      new WorkerReplyError(
        "The worker's /activity reply breaks the github-data contract:\n" +
          "✖ must list the events newest first, by createdAt\n" +
          "  → at data\n" +
          "Deploy the worker and the site from the same commit.",
      ),
    );
  });

  it("accepts events of one instant in either order", () => {
    const reply = {
      ...activityReply,
      data: [PULL_REQUEST_EVENT, { ...PULL_REQUEST_EVENT, id: "1" }],
    };
    const route = WORKER_ROUTES.activity;

    expect(route.encodeReply(route.parseReply(reply))).toStrictEqual(reply);
  });

  it("refuses an event type GitHub does not document", () => {
    expect(() =>
      parseEvents({ ...PULL_REQUEST_EVENT, type: "SponsorshipEvent" }),
    ).toThrow(
      new WorkerReplyError(
        "The worker's /activity reply breaks the github-data contract:\n" +
          '✖ Invalid option: expected one of "CommitCommentEvent"|"CreateEvent"|"DeleteEvent"|"DiscussionEvent"|"ForkEvent"|"GollumEvent"|"IssueCommentEvent"|"IssuesEvent"|"MemberEvent"|"PublicEvent"|"PullRequestEvent"|"PullRequestReviewEvent"|"PullRequestReviewCommentEvent"|"PushEvent"|"ReleaseEvent"|"WatchEvent"\n' +
          "  → at data[0].type\n" +
          "Deploy the worker and the site from the same commit.",
      ),
    );
  });

  it("refuses a named event in a repository off the allowlist", () => {
    expect(() =>
      parseEvents({
        ...PULL_REQUEST_EVENT,
        repository: "AsymptotaX/agents",
        url: "https://github.com/AsymptotaX/agents/pull/36",
      }),
    ).toThrow(
      new WorkerReplyError(
        "The worker's /activity reply breaks the github-data contract:\n" +
          "✖ must be the owner/name of a repository whose owner is on the allowlist; redact the event otherwise\n" +
          "  → at data[0].repository\n" +
          "Deploy the worker and the site from the same commit.",
      ),
    );
  });

  it("refuses a named event without a title", () => {
    expect(() => parseEvents({ ...PULL_REQUEST_EVENT, title: "" })).toThrow(
      new WorkerReplyError(
        "The worker's /activity reply breaks the github-data contract:\n" +
          "✖ Too small: expected string to have >=1 characters\n" +
          "  → at data[0].title\n" +
          "Deploy the worker and the site from the same commit.",
      ),
    );
  });

  it("refuses a redacted event that names its repository", () => {
    expect(() =>
      parseEvents({
        ...REDACTED_EVENT,
        repository: "lucasdj-sampaio/lucasdj-sampaio",
      }),
    ).toThrow(
      new WorkerReplyError(
        "The worker's /activity reply breaks the github-data contract:\n" +
          '✖ Unrecognized key: "repository"\n' +
          "  → at data[0]\n" +
          "Deploy the worker and the site from the same commit.",
      ),
    );
  });

  it.each([
    ["PullRequestEvent", "https://github.com/Nusnus/nusnus.github.io/pull/36"],
    [
      "PullRequestReviewEvent",
      "https://github.com/Nusnus/nusnus.github.io/pull/36#pullrequestreview-3452792458",
    ],
    [
      "PullRequestReviewCommentEvent",
      "https://github.com/Nusnus/nusnus.github.io/pull/36#discussion_r2486290442",
    ],
  ])("accepts a %s linking to its pull request, %s", (type, url) => {
    const reply = {
      ...activityReply,
      data: [{ ...PULL_REQUEST_EVENT, type, url }],
    };
    const route = WORKER_ROUTES.activity;

    expect(route.encodeReply(route.parseReply(reply))).toStrictEqual(reply);
  });

  it.each([
    "PullRequestEvent",
    "PullRequestReviewEvent",
    "PullRequestReviewCommentEvent",
  ])("refuses a %s linking to its repository", (type) => {
    expect(() =>
      parseEvents({
        ...PULL_REQUEST_EVENT,
        type,
        // The Events API sends no pull request's link, so a worker reading
        // one from the payload falls back to the repository's.
        url: "https://github.com/Nusnus/nusnus.github.io",
      }),
    ).toThrow(
      new WorkerReplyError(
        "The worker's /activity reply breaks the github-data contract:\n" +
          "✖ must link to the pull request the event acted on, such as https://github.com/celery/celery/pull/9000\n" +
          "  → at data[0].url\n" +
          "Deploy the worker and the site from the same commit.",
      ),
    );
  });

  it.each([
    "https://github.com/Nusnus/nusnus.github.io/issues/36",
    "https://github.com/Nusnus/nusnus.github.io/pull/36/files",
    "https://github.com/Nusnus/pull/36",
    "https://github.com/Nusnus/nusnus.github.io/pull/",
    "https://github.com/Nusnus/https://github.com/Nusnus/nusnus.github.io/pull/36",
    "https://github.com/celery/celery/pull/36",
    "https://github.com/Nusnus/nusnus.github.io/blob/main/pull/36",
  ])("refuses a pull request event linking to %s", (url) => {
    expect(() => parseEvents({ ...PULL_REQUEST_EVENT, url })).toThrow(
      new WorkerReplyError(
        "The worker's /activity reply breaks the github-data contract:\n" +
          "✖ must link to the pull request the event acted on, such as https://github.com/celery/celery/pull/9000\n" +
          "  → at data[0].url\n" +
          "Deploy the worker and the site from the same commit.",
      ),
    );
  });

  it("refuses a named event with a field the site does not render", () => {
    expect(() =>
      parseEvents({ ...PULL_REQUEST_EVENT, action: "closed" }),
    ).toThrow(
      new WorkerReplyError(
        "The worker's /activity reply breaks the github-data contract:\n" +
          '✖ Unrecognized key: "action"\n' +
          "  → at data[0]\n" +
          "Deploy the worker and the site from the same commit.",
      ),
    );
  });
});

describe("isEventType", () => {
  it.each([
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
  ])("holds GitHub's %s", (type) => {
    expect(isEventType(type)).toBe(true);
  });

  it.each(["SponsorshipEvent", "constructor"])(
    "refuses %s, which GitHub does not document",
    (type) => {
      expect(isEventType(type)).toBe(false);
    },
  );
});
