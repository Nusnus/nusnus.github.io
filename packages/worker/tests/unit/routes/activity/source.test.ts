/**
 * @file The activity route's source: Tomer's latest events, with the titles
 * the Events API lacks looked up in one request, and none when no event needs
 * one; and the events it skips, of types the contract does not hold or on
 * pages GitHub no longer has, logged.
 */

import { describe, expect, it, vi } from "vitest";

import { activitySource } from "../../../../src/routes/activity/source.ts";
import {
  EVENTS_OF_EVERY_TYPE,
  receivedRequests,
  recorded,
  recordedEvent,
  replayGitHub,
  servedFor,
  testClient,
  useFakeGitHub,
} from "../../../fixtures/github/fake.ts";

useFakeGitHub();

const USER_EVENTS = recorded("rest/users/Nusnus/events/public");
const CREATE_EVENT = recordedEvent("CreateEvent");

describe("activitySource", () => {
  it("counts its reply fresh for a minute, as recent activity changes often", () => {
    expect(activitySource.freshForSeconds).toBe(60);
  });

  it("looks up the titles its events lack in one request after the events", async () => {
    replayGitHub(USER_EVENTS, recorded("graphql/titles-of-user-events"));

    const events = await activitySource.fetchData(testClient().github);

    expect([
      receivedRequests().map(({ method, url }) => `${method} ${url}`),
      events.at(-1),
    ]).toStrictEqual([
      [
        "GET https://api.github.com/users/Nusnus/events/public",
        "POST https://api.github.com/graphql",
      ],
      {
        createdAt: new Date("2026-11-04T01:36:16Z"),
        id: "19064545085",
        repository: "Nusnus/nusnus.github.io",
        title:
          "feat: Cybernus — replace /chat with Matrix-themed AI digital self",
        type: "PullRequestEvent",
        url: "https://github.com/Nusnus/nusnus.github.io/pull/11",
        redacted: false,
      },
    ]);
  });

  it("looks up no title when no event needs one", async () => {
    // Each of these names its target without a page's title.
    replayGitHub({
      ...USER_EVENTS,
      body: EVENTS_OF_EVERY_TYPE.filter(({ type }) =>
        ["CreateEvent", "ForkEvent", "WatchEvent"].includes(type),
      ),
    });

    await activitySource.fetchData(testClient().github);

    expect(receivedRequests().map(({ url }) => url)).toStrictEqual([
      "https://api.github.com/users/Nusnus/events/public",
    ]);
  });

  it("logs the types of the events it skipped", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    // GitHub has sent no undocumented type yet, so a recorded event stands in
    // for such events, under types GitHub does not document.
    replayGitHub({
      ...USER_EVENTS,
      body: [
        { ...CREATE_EVENT, type: "SponsorshipEvent" },
        { ...CREATE_EVENT, type: "CheckRunEvent" },
      ],
    });

    await activitySource.fetchData(testClient().github);

    expect(warn).toHaveBeenCalledExactlyOnceWith(
      "Skipped GitHub events of types the github-data contract does not hold: SponsorshipEvent, CheckRunEvent. " +
        "Add each type to the contract and the site to show it.",
    );
  });

  it("logs the pages GitHub no longer has, whose events it skipped", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    // GitHub answers null for each page it does not have, as its recorded
    // answer for one missing pull request shows; Tomer's events' pages all
    // exist, so this extends that answer to each of their seven.
    const missing = recorded("graphql/titles-of-missing-pull-request");
    replayGitHub(
      USER_EVENTS,
      servedFor(
        {
          ...missing,
          body: {
            data: Object.fromEntries(
              Array.from({ length: 7 }, (_, index) => [
                `resource${String(index)}`,
                null,
              ]),
            ),
          },
        },
        recorded("graphql/titles-of-user-events").request,
      ),
    );

    const events = await activitySource.fetchData(testClient().github);

    expect(events.map(({ id }) => id)).toStrictEqual([
      "26096844714",
      "26096844952",
      "26096845310",
    ]);
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      "Skipped recent events on pull requests or commits GitHub no longer has: " +
        "https://github.com/Nusnus/nustack/commit/4a4971bbf03f31c673ebe5c23bd8e32918e6cc61, " +
        "https://github.com/Nusnus/nusnus.github.io/pull/7, " +
        "https://github.com/Nusnus/nusnus.github.io/pull/36, " +
        "https://github.com/Nusnus/nusnus.github.io/pull/35, " +
        "https://github.com/Nusnus/nusnus.github.io/pull/20, " +
        "https://github.com/Nusnus/nusnus.github.io/pull/12, " +
        "https://github.com/Nusnus/nusnus.github.io/pull/11.",
    );
  });
});
