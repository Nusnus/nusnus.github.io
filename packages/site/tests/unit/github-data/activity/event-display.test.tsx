/**
 * @file How the activity feed shows each event type: its label, its title's
 * prefix, its icon and the icon's colour; how it shows a redacted event,
 * naming neither its repository nor what it acted on; and the size of every
 * icon.
 */

import type { ActivityEvent, EventType } from "@nusnus/github-data/activity";

import { describe, expect, it } from "vitest";

import { displayEvent } from "../../../../src/github-data/activity/event-display.tsx";
import { findElement, render } from "../../../fixtures/unit-page.ts";

function namedEvent(type: EventType): ActivityEvent {
  return {
    createdAt: new Date("2026-11-04T01:36:16Z"),
    id: "19064549154",
    redacted: false,
    repository: "celery/celery",
    title: "Fix the retry loop",
    type,
    url: "https://github.com/celery/celery/pull/9000",
  };
}

function iconClasses(event: ActivityEvent): string[] {
  return [
    ...findElement(render(displayEvent(event).icon).container, "svg").classList,
  ];
}

describe("displayEvent", () => {
  it.each([
    [
      "CommitCommentEvent",
      "Commented",
      "Comment: Fix the retry loop",
      "lucide-message-square",
      "text-purple-400",
    ],
    [
      "CreateEvent",
      "Created",
      "Fix the retry loop",
      "lucide-circle-plus",
      "text-status-active",
    ],
    [
      "DeleteEvent",
      "Deleted",
      "Fix the retry loop",
      "lucide-activity",
      "text-red-400",
    ],
    [
      "DiscussionEvent",
      "Discussion",
      "Fix the retry loop",
      "lucide-activity",
      "text-text-secondary",
    ],
    [
      "ForkEvent",
      "Forked",
      "Fix the retry loop",
      "lucide-activity",
      "text-text-secondary",
    ],
    [
      "GollumEvent",
      "Wiki",
      "Fix the retry loop",
      "lucide-activity",
      "text-text-secondary",
    ],
    [
      "IssueCommentEvent",
      "Commented",
      "Comment: Fix the retry loop",
      "lucide-message-square",
      "text-purple-400",
    ],
    [
      "IssuesEvent",
      "Issue",
      "Fix the retry loop",
      "lucide-activity",
      "text-orange-400",
    ],
    [
      "MemberEvent",
      "Member",
      "Fix the retry loop",
      "lucide-activity",
      "text-text-secondary",
    ],
    [
      "PublicEvent",
      "Made public",
      "Fix the retry loop",
      "lucide-activity",
      "text-text-secondary",
    ],
    [
      "PullRequestEvent",
      "Pull Request",
      "Fix the retry loop",
      "lucide-git-pull-request",
      "text-status-active",
    ],
    [
      "PullRequestReviewCommentEvent",
      "Reviewed",
      "Review: Fix the retry loop",
      "lucide-circle-check",
      "text-blue-400",
    ],
    [
      "PullRequestReviewEvent",
      "Reviewed",
      "Review: Fix the retry loop",
      "lucide-circle-check",
      "text-blue-400",
    ],
    [
      "PushEvent",
      "Pushed",
      "Fix the retry loop",
      "lucide-git-commit-horizontal",
      "text-accent",
    ],
    [
      "ReleaseEvent",
      "Released",
      "Fix the retry loop",
      "lucide-activity",
      "text-accent",
    ],
    [
      "WatchEvent",
      "Starred",
      "Fix the retry loop",
      "lucide-activity",
      "text-text-secondary",
    ],
  ] as const)(
    "shows a %s as %s, titled %s, with the %s icon in %s",
    (type, label, title, icon, color) => {
      const event = namedEvent(type);
      const display = displayEvent(event);

      expect([
        display.typeLabel,
        display.title,
        display.repositoryName,
        iconClasses(event).filter((name) => name === icon || name === color),
      ]).toStrictEqual([label, title, "celery", [icon, color]]);
    },
  );

  it("names a redacted event's type alone, in words, in a private project", () => {
    const display = displayEvent({
      createdAt: new Date("2026-11-02T13:21:49Z"),
      id: "26112798784",
      redacted: true,
      type: "PullRequestReviewCommentEvent",
      url: "https://github.com/mssoka",
    });

    expect([
      display.title,
      display.repositoryName,
      display.typeLabel,
    ]).toStrictEqual([
      "Pull Request Review Comment",
      "Private Project",
      "Reviewed",
    ]);
  });

  it("sizes every icon for an activity feed row and hides it from screen readers", () => {
    const icon = findElement(
      render(displayEvent(namedEvent("PushEvent")).icon).container,
      "svg",
    );

    expect([
      icon.getAttribute("aria-hidden"),
      [...icon.classList],
    ]).toStrictEqual([
      "true",
      expect.arrayContaining(["mt-0.5", "h-4", "w-4", "shrink-0"]),
    ]);
  });
});
