/**
 * @file Recent events: of the events GitHub lists, those of the types the
 * contract holds, up to the activity feed's limit, each named with its target
 * in an allowlisted repository and redacted elsewhere; the types it skips; the
 * pages whose titles to look up, never for a redacted event; and the reply's
 * events once titled, without those whose page GitHub no longer has, which it
 * lists.
 */

import { describe, expect, it } from "vitest";

import type { GitHubEvent } from "../../../../src/routes/activity/event-targets.ts";

import { parseGitHubData } from "../../../../src/github/failures.ts";
import {
  githubEventsSchema,
  recentEvents,
  titledEvents,
  titlePageTargets,
} from "../../../../src/routes/activity/recent-events.ts";
import {
  EVENTS_OF_EVERY_TYPE,
  recorded,
  recordedEvent,
} from "../../../fixtures/github/fake.ts";

const EVERY_TYPE = parseEvents(EVENTS_OF_EVERY_TYPE);
const TOMERS_EVENTS = parseEvents(
  recorded("rest/users/Nusnus/events/public").body,
);
const NUSTACK_RELEASE =
  "https://github.com/Nusnus/nustack/commit/4a4971bbf03f31c673ebe5c23bd8e32918e6cc61";

const PUSH = tomersEvent(0);

function parseEvents(json: unknown) {
  return parseGitHubData("events", githubEventsSchema, json);
}

function tomersEvent(index: number): GitHubEvent {
  const event = TOMERS_EVENTS[index];
  if (event === undefined) {
    throw new Error(`Tomer's recorded events have none at ${String(index)}.`);
  }
  return event;
}

describe("recentEvents", () => {
  it("skips the events of types the contract does not hold, listing their types", () => {
    // GitHub has sent no undocumented type yet, so recorded events stand in
    // for such events, under types GitHub does not document.
    const recent = recentEvents([
      { ...PUSH, type: "SponsorshipEvent" },
      PUSH,
      { ...PUSH, type: "CheckRunEvent" },
    ]);

    expect([
      recent.skippedTypes,
      recent.events.map(({ event }) => event.id),
    ]).toStrictEqual([["SponsorshipEvent", "CheckRunEvent"], ["26100857757"]]);
  });

  it("lists the events newest first, whatever order GitHub sends them in", () => {
    const older = {
      ...PUSH,
      created_at: new Date("2026-11-01T10:00:00Z"),
      id: "1",
    };
    const newer = {
      ...PUSH,
      created_at: new Date("2026-11-04T07:00:00Z"),
      id: "2",
    };

    expect(
      recentEvents([older, newer]).events.map(({ event }) => event.id),
    ).toStrictEqual(["2", "1"]);
  });
});

describe("titlePageTargets", () => {
  it("lists the page whose title each named event takes", () => {
    expect(titlePageTargets(recentEvents(TOMERS_EVENTS))).toStrictEqual([
      {
        reference: "4a4971b",
        titlePageUrl: NUSTACK_RELEASE,
        url: NUSTACK_RELEASE,
      },
      {
        reference: "#7",
        titlePageUrl: "https://github.com/Nusnus/nusnus.github.io/pull/7",
        url: "https://github.com/Nusnus/nusnus.github.io/pull/7",
      },
      {
        reference: "#36",
        titlePageUrl: "https://github.com/Nusnus/nusnus.github.io/pull/36",
        url: "https://github.com/Nusnus/nusnus.github.io/pull/36",
      },
      {
        reference: "#35",
        titlePageUrl: "https://github.com/Nusnus/nusnus.github.io/pull/35",
        url: "https://github.com/Nusnus/nusnus.github.io/pull/35",
      },
      {
        reference: "#20",
        titlePageUrl: "https://github.com/Nusnus/nusnus.github.io/pull/20",
        url: "https://github.com/Nusnus/nusnus.github.io/pull/20",
      },
      {
        reference: "#12",
        titlePageUrl: "https://github.com/Nusnus/nusnus.github.io/pull/12",
        url: "https://github.com/Nusnus/nusnus.github.io/pull/12",
      },
      {
        reference: "#11",
        titlePageUrl: "https://github.com/Nusnus/nusnus.github.io/pull/11",
        url: "https://github.com/Nusnus/nusnus.github.io/pull/11",
      },
    ]);
  });

  it("looks up no page for a redacted event, even one on a commit", () => {
    // The recorded commit comment is in a repository off the allowlist.
    expect(
      titlePageTargets(
        recentEvents(parseEvents([recordedEvent("CommitCommentEvent")])),
      ),
    ).toStrictEqual([]);
  });
});

describe("titledEvents", () => {
  it("names each recent event in an allowlisted repository by what it acted on, redacts the rest to their owner's page, and holds the activity feed's worth", () => {
    expect(
      titledEvents(
        recentEvents(EVERY_TYPE),
        new Map([
          [
            "https://github.com/celery/celery/pull/10998",
            "Fix#10997 - redis chord claim cleanup ownership",
          ],
          [
            "https://github.com/celery/celery/pull/11013",
            "Chore(deps): Bump google-cloud-storage from 3.15.0 to 3.17.1",
          ],
        ]),
      ),
    ).toStrictEqual({
      events: [
        {
          createdAt: new Date("2026-11-03T22:46:00Z"),
          id: "19052389636",
          repository: "celery/celery",
          title: "celery/celery",
          type: "WatchEvent",
          url: "https://github.com/celery/celery",
          redacted: false,
        },
        {
          createdAt: new Date("2026-11-03T22:20:56Z"),
          id: "19056861397",
          repository: "celery/celery",
          title: "Chore(deps): Bump google-cloud-storage from 3.15.0 to 3.17.1",
          type: "IssueCommentEvent",
          url: "https://github.com/celery/celery/pull/11013#issuecomment-6616873615",
          redacted: false,
        },
        {
          createdAt: new Date("2026-11-03T22:13:29Z"),
          id: "19049759593",
          repository: "celery/celery",
          title: "Chore(deps): Bump google-cloud-storage from 3.15.0 to 3.17.1",
          type: "PullRequestEvent",
          url: "https://github.com/celery/celery/pull/11013",
          redacted: false,
        },
        {
          createdAt: new Date("2026-11-03T17:46:09Z"),
          id: "19026064367",
          repository: "celery/kombu",
          title: "celery/kombu",
          type: "ForkEvent",
          url: "https://github.com/celery/kombu",
          redacted: false,
        },
        {
          createdAt: new Date("2026-11-03T16:16:46Z"),
          id: "19017255962",
          repository: "celery/celery",
          title: "Fix#10997 - redis chord claim cleanup ownership",
          type: "PullRequestReviewEvent",
          url: "https://github.com/celery/celery/pull/10998#pullrequestreview-5755689046",
          redacted: false,
        },
        {
          createdAt: new Date("2026-11-03T16:16:43Z"),
          id: "19042417216",
          repository: "celery/celery",
          title: "Fix#10997 - redis chord claim cleanup ownership",
          type: "PullRequestReviewCommentEvent",
          url: "https://github.com/celery/celery/pull/10998#discussion_r4457381163",
          redacted: false,
        },
        {
          createdAt: new Date("2026-11-03T15:31:36Z"),
          id: "19012746022",
          type: "DiscussionEvent",
          url: "https://github.com/github",
          redacted: true,
        },
        {
          createdAt: new Date("2026-11-03T15:11:30Z"),
          id: "19010757183",
          type: "GollumEvent",
          url: "https://github.com/TheThinkingHome",
          redacted: true,
        },
        {
          createdAt: new Date("2026-11-03T15:06:18Z"),
          id: "19010281848",
          type: "PublicEvent",
          url: "https://github.com/LightSulivy",
          redacted: true,
        },
        {
          createdAt: new Date("2026-11-03T15:03:16Z"),
          id: "19009937425",
          type: "MemberEvent",
          url: "https://github.com/raequan-shadow",
          redacted: true,
        },
      ],
      missingPages: [],
    });
  });

  it("titles an event by its page's title", () => {
    expect(
      titledEvents(
        recentEvents([PUSH]),
        new Map([[NUSTACK_RELEASE, "chore(release): 0.0.2 (#35)"]]),
      ),
    ).toStrictEqual({
      events: [
        {
          createdAt: new Date("2026-11-04T02:21:56Z"),
          id: "26100857757",
          repository: "Nusnus/nustack",
          title: "chore(release): 0.0.2 (#35)",
          type: "PushEvent",
          url: NUSTACK_RELEASE,
          redacted: false,
        },
      ],
      missingPages: [],
    });
  });

  it("leaves out an event whose page GitHub no longer has, listing the page once", () => {
    expect(titledEvents(recentEvents([PUSH, PUSH]), new Map())).toStrictEqual({
      events: [],
      missingPages: [NUSTACK_RELEASE],
    });
  });
});
