/**
 * @file Event targets: what each event type the contract holds acted on, read
 * from its payload, with the page to take the title from, and that page's
 * reference, where the payload lacks the title; a created repository and a
 * release without a title named as GitHub names them; and a payload that lacks
 * what its type documents, or gives an empty title, refused.
 */

import type { EventType } from "@nusnus/github-data/activity";

import { describe, expect, it } from "vitest";

import { parseGitHubData } from "../../../../src/github/failures.ts";
import {
  type GitHubEvent,
  githubEventSchema,
  readTarget,
} from "../../../../src/routes/activity/event-targets.ts";
import { recorded, recordedEvent } from "../../../fixtures/github/fake.ts";
import { MISSHAPEN_STEP } from "../../../fixtures/next-steps.ts";

const CREATE_EVENT = recordedEvent("CreateEvent");

// The recorded release event, carrying another release.
function releaseEventOf(release: unknown): GitHubEvent<EventType> {
  const releaseEvent = recordedEvent("ReleaseEvent");
  return asEvent(
    { ...releaseEvent, payload: { ...releaseEvent.payload, release } },
    "ReleaseEvent",
  );
}

function asEvent(event: object, type: EventType): GitHubEvent<EventType> {
  return {
    ...parseGitHubData("event", githubEventSchema, event),
    type,
  };
}

describe("readTarget", () => {
  it.each([
    [
      "CommitCommentEvent",
      {
        reference: "339614d",
        titlePageUrl:
          "https://github.com/matheusmachadoemp-bit/Portal/commit/339614da930b56d482fbf601a4faf43fe165c9fc",
        url: "https://github.com/matheusmachadoemp-bit/Portal/commit/339614da930b56d482fbf601a4faf43fe165c9fc#commitcomment-207944546",
      },
    ],
    [
      "CreateEvent",
      { title: "rel452", url: "https://github.com/celery/py-amqp" },
    ],
    [
      "DeleteEvent",
      { title: "kombup", url: "https://github.com/celery/kombu" },
    ],
    [
      "DiscussionEvent",
      {
        title:
          "[uk ai resilience] [uk-ai-resilience] Recent-change risk & resilience report 2026-11-03",
        url: "https://github.com/github/gh-aw/discussions/74549",
      },
    ],
    [
      "ForkEvent",
      { title: "celery/kombu", url: "https://github.com/celery/kombu" },
    ],
    [
      "GollumEvent",
      {
        title: "Home",
        url: "https://github.com/TheThinkingHome/device_sentinel/wiki/Home",
      },
    ],
    [
      "IssueCommentEvent",
      {
        title: "Chore(deps): Bump google-cloud-storage from 3.15.0 to 3.17.1",
        url: "https://github.com/celery/celery/pull/11013#issuecomment-6616873615",
      },
    ],
    [
      "IssuesEvent",
      {
        title:
          "Redis: synchronous `drain_events()` loses messages after the health check reconnects an idle BRPOP connection (follow-up to #2630)",
        url: "https://github.com/celery/kombu/issues/2815",
      },
    ],
    [
      "MemberEvent",
      { title: "jayasmitadatta", url: "https://github.com/jayasmitadatta" },
    ],
    [
      "PublicEvent",
      {
        title: "LightSulivy/Ontology-Generation-LLM",
        url: "https://github.com/LightSulivy/Ontology-Generation-LLM",
      },
    ],
    [
      "PullRequestEvent",
      {
        reference: "#11013",
        titlePageUrl: "https://github.com/celery/celery/pull/11013",
        url: "https://github.com/celery/celery/pull/11013",
      },
    ],
    [
      "PullRequestReviewCommentEvent",
      {
        reference: "#10998",
        titlePageUrl: "https://github.com/celery/celery/pull/10998",
        url: "https://github.com/celery/celery/pull/10998#discussion_r4457381163",
      },
    ],
    [
      "PullRequestReviewEvent",
      {
        reference: "#10998",
        titlePageUrl: "https://github.com/celery/celery/pull/10998",
        url: "https://github.com/celery/celery/pull/10998#pullrequestreview-5755689046",
      },
    ],
    [
      "PushEvent",
      {
        reference: "7d2fcd2",
        titlePageUrl:
          "https://github.com/celery/billiard/commit/7d2fcd2a2d0978d2c9062b8566fac0f7f84e5399",
        url: "https://github.com/celery/billiard/commit/7d2fcd2a2d0978d2c9062b8566fac0f7f84e5399",
      },
    ],
    [
      "ReleaseEvent",
      {
        title: "v5.7.0",
        url: "https://github.com/celery/kombu/releases/tag/v5.7.0",
      },
    ],
    [
      "WatchEvent",
      { title: "celery/celery", url: "https://github.com/celery/celery" },
    ],
  ] as const)("reads what a %s acted on", (type, target) => {
    expect(readTarget(asEvent(recordedEvent(type), type))).toStrictEqual(
      target,
    );
  });

  it("titles a created repository by its full name", () => {
    // GitHub documents a null ref for a created repository, but none of the
    // events recorded had one, so this one is a created branch's, ref removed.
    expect(
      readTarget(
        asEvent(
          { ...CREATE_EVENT, payload: { ...CREATE_EVENT.payload, ref: null } },
          "CreateEvent",
        ),
      ),
    ).toStrictEqual({
      title: "celery/py-amqp",
      url: "https://github.com/celery/py-amqp",
    });
  });

  it("titles a release by its name, which can differ from its tag", () => {
    // A recorded release event carrying a release recorded with a name.
    expect(
      readTarget(
        releaseEventOf(
          recorded("rest/repos/celery/celery/releases/tags/v5.2.7").body,
        ),
      ),
    ).toStrictEqual({
      title: "5.2.7",
      url: "https://github.com/celery/celery/releases/tag/v5.2.7",
    });
  });

  it("titles a release published without a title by its tag", () => {
    // A recorded release event carrying a release recorded without a title.
    expect(
      readTarget(
        releaseEventOf(
          recorded("rest/repos/celery/celery/releases/tags/v5.2.0rc1").body,
        ),
      ),
    ).toStrictEqual({
      title: "v5.2.0rc1",
      url: "https://github.com/celery/celery/releases/tag/v5.2.0rc1",
    });
  });

  it("titles a release with no name by its tag", () => {
    // GitHub documents a null name, which no recorded release has, so a
    // recorded release's name is removed here.
    const release = recorded("rest/repos/celery/celery/releases/tags/v5.2.7")
      .body as object;

    expect(
      readTarget(releaseEventOf({ ...release, name: null })),
    ).toStrictEqual({
      title: "v5.2.7",
      url: "https://github.com/celery/celery/releases/tag/v5.2.7",
    });
  });

  it("reads a delete event's ref from a payload that has one", () => {
    // The recorded create event given a delete event's type, which the next
    // test refuses once its ref is removed.
    expect(readTarget(asEvent(CREATE_EVENT, "DeleteEvent"))).toStrictEqual({
      title: "rel452",
      url: "https://github.com/celery/py-amqp",
    });
  });

  it("refuses a payload that lacks what its type documents, naming the event", () => {
    expect(() =>
      readTarget(
        asEvent(
          { ...CREATE_EVENT, payload: { ...CREATE_EVENT.payload, ref: null } },
          "DeleteEvent",
        ),
      ),
    ).toThrow(
      expect.objectContaining({
        kind: "misshapen",
        message:
          "GitHub's DeleteEvent 26092827554 payload is not in the shape the worker reads:\n" +
          "✖ Invalid input: expected string, received null\n" +
          "  → at ref\n" +
          MISSHAPEN_STEP,
        name: "GitHubError",
      }),
    );
  });

  it("refuses a wiki event that updated no page", () => {
    // GitHub documents at least one page; a recorded event, its pages removed.
    expect(() =>
      readTarget(
        asEvent(
          { ...recordedEvent("GollumEvent"), payload: { pages: [] } },
          "GollumEvent",
        ),
      ),
    ).toThrow(
      expect.objectContaining({
        kind: "misshapen",
        message:
          "GitHub's GollumEvent 19010757183 payload is not in the shape the worker reads:\n" +
          "✖ Invalid input: expected object, received undefined\n" +
          "  → at pages[0]\n" +
          MISSHAPEN_STEP,
        name: "GitHubError",
      }),
    );
  });

  it("refuses a target whose title is empty", () => {
    // A recorded issue event, its issue's title emptied.
    const issuesEvent = recordedEvent("IssuesEvent");

    expect(() =>
      readTarget(
        asEvent(
          {
            ...issuesEvent,
            payload: {
              ...issuesEvent.payload,
              issue: { ...issuesEvent.payload.issue, title: "" },
            },
          },
          "IssuesEvent",
        ),
      ),
    ).toThrow(
      expect.objectContaining({
        kind: "misshapen",
        message:
          "GitHub's IssuesEvent 18996162649 payload is not in the shape the worker reads:\n" +
          "✖ Too small: expected string to have >=1 characters\n" +
          "  → at issue.title\n" +
          MISSHAPEN_STEP,
        name: "GitHubError",
      }),
    );
  });
});
