/**
 * @file The fake GitHub: a request to another host fails; each exchange is
 * found by the name of its request, and a name with no exchange fails, saying
 * where to look; one real event of each type the contract holds is found by
 * its type, and a type with no event fails, saying where to add one; a
 * replayed exchange answers only the request it recorded, as often as it
 * comes, with the status, headers and body GitHub sent, and the fake lists
 * every request it received; an outage fails the requests it names, as often
 * as it is told to, before any exchange answers them; an exchange can be
 * served for another request or with an expiring token; and a test client's
 * waits pass in no time, moving its clock on, as moving it on by hand does.
 */

import type { EventType } from "@nusnus/github-data/activity";

import * as schema from "@nusnus/github-data/schema";
import { describe, expect, it, vi } from "vitest";

import {
  EVENTS_OF_EVERY_TYPE,
  failGitHub,
  receivedRequests,
  recorded,
  recordedEvent,
  replayGitHub,
  servedFor,
  testClient,
  useFakeGitHub,
  withExpiringToken,
} from "../../../fixtures/github/fake.ts";
import { DEADLINE_SPENT_STEP } from "../../../fixtures/next-steps.ts";

useFakeGitHub();

const USER = { method: "GET", url: "https://api.github.com/users/Nusnus" };

async function fetchUser(init: RequestInit = {}): Promise<Response> {
  return fetch("https://api.github.com/users/Nusnus", init);
}

describe("useFakeGitHub", () => {
  it("fails a request to another host, rather than reaching it", async () => {
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await expect(fetch("https://example.com/")).rejects.toThrow(
      // MSW's error class is its own, which it does not export.
      expect.objectContaining({
        message:
          '[MSW] Cannot bypass a request when using the "error" strategy for the "onUnhandledFrame" option.',
        name: "InternalError",
      }),
    );
    expect(error).toHaveBeenCalledExactlyOnceWith(
      "[MSW] Error: intercepted a request without a matching request handler:\n\n" +
        "  • GET https://example.com/\n\n" +
        "If you still wish to intercept this unhandled request, please create a request handler for it.\n" +
        "Read more: https://mswjs.io/docs/http/intercepting-requests",
    );
  });
});

describe("recorded", () => {
  it("finds the exchange recorded for a request", () => {
    expect(recorded("rest/users/Nusnus").request).toStrictEqual(USER);
  });

  it("refuses a name no exchange is recorded as, saying where to look", () => {
    expect(() => recorded("rest/users/nobody")).toThrow(
      new Error(
        "No exchange is recorded as rest/users/nobody; check the name against the exchanges beside the fake GitHub's module.",
      ),
    );
  });
});

describe("EVENTS_OF_EVERY_TYPE", () => {
  it("holds one real event of each type the contract holds", () => {
    expect(EVENTS_OF_EVERY_TYPE.map(({ type }) => type)).toStrictEqual([
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
    ]);
  });
});

describe("recordedEvent", () => {
  it("finds the event recorded of a type", () => {
    expect(recordedEvent("PushEvent").id).toBe("26095510922");
  });

  it("refuses a type no event is recorded of, saying where to add one", () => {
    // Every type the contract holds has an event, so a type it does not hold
    // stands in.
    expect(() => recordedEvent("SponsorshipEvent" as EventType)).toThrow(
      new Error(
        "No SponsorshipEvent is recorded in events-of-every-type.json; add a real one, as the fake GitHub's docstring says.",
      ),
    );
  });
});

describe("servedFor", () => {
  it("serves an exchange's reply for another request", async () => {
    replayGitHub(
      servedFor(recorded("rest/repos/celery/no-such-repository"), USER),
    );

    expect((await fetchUser()).status).toBe(404);
  });
});

describe("withExpiringToken", () => {
  it("sends the expiry GitHub sends for a fine-grained token", async () => {
    replayGitHub(withExpiringToken(recorded("rest/users/Nusnus")));

    expect(
      (await fetchUser()).headers.get("GitHub-Authentication-Token-Expiration"),
    ).toBe("2023-04-26 23:23:18 +0200");
  });
});

describe("replayGitHub", () => {
  it("answers a request with the status, headers and body recorded for it", async () => {
    replayGitHub(recorded("rest/users/Nusnus"));

    const response = await fetchUser();

    expect({
      body: await response.json(),
      etag: response.headers.get("ETag"),
      status: response.status,
    }).toStrictEqual({
      body: recorded("rest/users/Nusnus").body,
      etag: 'W/"49f06bebac6aef4ad92a09043466d6490aa5556dba51bd4b105ca8319e5975b1"',
      status: 200,
    });
  });

  it("answers a reply with no body with none", async () => {
    replayGitHub(
      servedFor(
        recorded("rest/repos/meilix/meilix-docs/contributors.page-1"),
        USER,
      ),
    );

    const response = await fetchUser();

    expect([response.status, await response.text()]).toStrictEqual([204, ""]);
  });

  it("answers a request as often as it comes", async () => {
    replayGitHub(recorded("rest/users/Nusnus"));

    const responses = [await fetchUser(), await fetchUser()];

    expect(responses.map(({ status }) => status)).toStrictEqual([200, 200]);
  });

  it("answers a request whose body matches the recorded one", async () => {
    const contributions = recorded("graphql/contributions");
    replayGitHub(contributions);

    const response = await fetch("https://api.github.com/graphql", {
      body: JSON.stringify(contributions.request.body),
      method: "POST",
    });

    expect(response.status).toBe(200);
  });

  it.each([
    ["method", "https://api.github.com/users/Nusnus", { method: "DELETE" }],
    ["path", "https://api.github.com/users/nobody", {}],
    ["query", "https://api.github.com/users/Nusnus?page=2", {}],
    [
      "body",
      "https://api.github.com/graphql",
      { body: '{"query":"{ viewer { login } }"}', method: "POST" },
    ],
  ] as const)(
    "fails a request that differs from every replayed one in its %s, as if GitHub were out of reach",
    async (_difference, url, init) => {
      replayGitHub(
        recorded("rest/users/Nusnus"),
        recorded("graphql/contributions"),
      );

      await expect(fetch(url, init)).rejects.toThrow(
        // MSW's error comes from another realm, whose TypeError is not this
        // one's.
        expect.objectContaining({
          message: "Failed to fetch",
          name: "TypeError",
        }),
      );
    },
  );
});

describe("receivedRequests", () => {
  it("lists each request the fake received, in order, with its headers", async () => {
    replayGitHub(recorded("rest/users/Nusnus"));

    await fetchUser({ headers: { Authorization: "Bearer test-token" } });
    await fetchUser();

    expect(receivedRequests()).toStrictEqual([
      {
        headers: { authorization: "Bearer test-token" },
        method: "GET",
        url: "https://api.github.com/users/Nusnus",
      },
      {
        headers: {},
        method: "GET",
        url: "https://api.github.com/users/Nusnus",
      },
    ]);
  });
});

describe("failGitHub", () => {
  it("fails a request with an outage's reply as often as told, then lets the exchange answer", async () => {
    replayGitHub(recorded("rest/users/Nusnus"));
    failGitHub(USER, { status: 503, headers: { "Retry-After": "1" } }, 2);

    const responses = [await fetchUser(), await fetchUser(), await fetchUser()];

    expect(
      responses.map((response) => [
        response.status,
        response.headers.get("Retry-After"),
      ]),
    ).toStrictEqual([
      [503, "1"],
      [503, "1"],
      [200, null],
    ]);
  });

  it("fails every request it names, unless told how often", async () => {
    failGitHub(USER, { status: 503, headers: {} });
    replayGitHub(recorded("rest/users/Nusnus"));

    await fetchUser();

    expect((await fetchUser()).status).toBe(503);
  });

  it("fails only the requests it names", async () => {
    failGitHub(USER, "unreachable");
    replayGitHub(recorded("rest/repos/celery/kombu"));

    expect(
      (await fetch("https://api.github.com/repos/celery/kombu")).status,
    ).toBe(200);
  });

  it("puts GitHub out of reach of an unreachable request", async () => {
    replayGitHub(recorded("rest/users/Nusnus"));
    failGitHub(USER, "unreachable");

    await expect(fetchUser()).rejects.toThrow(
      // MSW's error comes from another realm, whose TypeError is not this
      // one's.
      expect.objectContaining({
        message: "Failed to fetch",
        name: "TypeError",
      }),
    );
  });

  it("never answers a silent request, until its caller gives up", async () => {
    replayGitHub(recorded("rest/users/Nusnus"));
    failGitHub(USER, "silence");

    // Only a real wait shows that no answer comes, and a short one does.
    await expect(
      fetchUser({ signal: AbortSignal.timeout(10) }),
    ).rejects.toThrow(
      // workerd gives each DOMException its own stack and retryable flag, so
      // the error's name and message stand in for it.
      expect.objectContaining({
        message: "The operation was aborted due to timeout",
        name: "TimeoutError",
      }),
    );
  });
});

describe("testClient", () => {
  const loginRead = {
    nextStepIfNotFound: "",
    pathAndQuery: "/users/Nusnus",
    replySchema: schema.object({ login: schema.string() }),
  } as const;

  it("passes the waits its client asks for in no time, listing each", async () => {
    replayGitHub(recorded("rest/users/Nusnus"));
    failGitHub(USER, { status: 503, headers: {} }, 1);
    const { github, waits } = testClient();

    await expect(github.get(loginRead)).resolves.toStrictEqual({
      login: "Nusnus",
    });
    expect(waits).toStrictEqual([750]);
  });

  it("moves its client's clock on with each wait, and by hand", async () => {
    replayGitHub(recorded("rest/users/Nusnus"));
    failGitHub(USER, { status: 503, headers: {} }, 1);
    const { advance, github } = testClient({ deadlineMs: 1000 });
    await github.get(loginRead);

    advance(250);

    await expect(github.get(loginRead)).rejects.toThrow(
      expect.objectContaining({
        kind: "transient",
        message:
          "The worker's 1000 ms to fetch from GitHub ran out before GET /users/Nusnus could start, after GET /users/Nusnus.\n" +
          DEADLINE_SPENT_STEP,
        name: "GitHubError",
      }),
    );
  });
});
