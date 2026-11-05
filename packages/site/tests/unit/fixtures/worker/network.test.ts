/**
 * @file The fakes of the worker's network and of a client's time. The network
 * answers each route with the worker's recorded reply, any other path with
 * its recorded 404, serves the replies a test gives and fails the paths it
 * chooses; the not-found and unavailable failures answer with the worker's
 * recorded 404 and 502; the silent network answers only with its signal's
 * abort, and never without a signal; and the test timing never times out and
 * records each wait.
 */

import {
  activityReply,
  contributionGraphReply,
  profileReply,
  repositoriesReply,
} from "@nusnus/github-data/fixtures/worker-replies";
import { WORKER_ROUTES } from "@nusnus/github-data/routes";
import { describe, expect, it } from "vitest";

import {
  FAKE_WORKER_ORIGIN,
  silentNetwork,
  testTiming,
  workerNetwork,
  workerNotFound,
  workerUnavailable,
} from "../../../fixtures/worker/network.ts";

const NOT_FOUND_ERROR = {
  error:
    "The worker has no route at /no-such-route; it serves /activity, /contribution-graph, /profile, /repositories.",
};

describe("workerNetwork", () => {
  it("answers each route with its recorded reply, as JSON open to every origin", async () => {
    const network = workerNetwork();

    const responses = await Promise.all(
      Object.values(WORKER_ROUTES).map(async (route) => {
        const response = await network(route.urlAt(FAKE_WORKER_ORIGIN));
        return [
          response.status,
          response.headers.get("access-control-allow-origin"),
          response.headers.get("content-type"),
          (await response.json()) as unknown,
        ];
      }),
    );

    expect(responses).toStrictEqual([
      [200, "*", "application/json", activityReply],
      [200, "*", "application/json", contributionGraphReply],
      [200, "*", "application/json", profileReply],
      [200, "*", "application/json", repositoriesReply],
    ]);
  });

  it("answers any other path with the worker's recorded 404", async () => {
    const response = await workerNetwork()(
      new URL("/nothing", FAKE_WORKER_ORIGIN),
    );

    expect([response.status, await response.json()]).toStrictEqual([
      404,
      NOT_FOUND_ERROR,
    ]);
  });

  it("serves the reply a test gives for a path", async () => {
    const response = await workerNetwork({
      replies: { "/profile": { data: "given" } },
    })(new Request(new URL("/profile", FAKE_WORKER_ORIGIN)));

    expect(await response.json()).toStrictEqual({ data: "given" });
  });

  it("fails the paths a test chooses", async () => {
    const network = workerNetwork({
      failing: { "/profile": workerNotFound },
    });

    const response = await network(new URL("/profile", FAKE_WORKER_ORIGIN));

    expect([response.status, await response.json()]).toStrictEqual([
      404,
      NOT_FOUND_ERROR,
    ]);
  });
});

describe("workerNotFound", () => {
  it("answers with the worker's recorded 404", async () => {
    const response = await workerNotFound();

    expect([response.status, await response.json()]).toStrictEqual([
      404,
      NOT_FOUND_ERROR,
    ]);
  });
});

describe("workerUnavailable", () => {
  it("answers with the worker's recorded 502, sent while GitHub refused it", async () => {
    const response = await workerUnavailable();

    expect([response.status, await response.json()]).toStrictEqual([
      502,
      {
        error:
          "GitHub data for /profile is unavailable, and the worker has no cached reply to serve: " +
          'GitHub answered GET /users/Nusnus with 403: {"message":"API rate limit exceeded for 203.0.113.7. ' +
          "(But here's the good news: Authenticated requests get a higher rate limit. Check out the documentation for more details.)\"," +
          '"documentation_url":"https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting"}\n' +
          "GitHub allows requests again at 2026-11-04T08:20:04.000Z.\n" +
          "The worker asks GitHub again at 2026-11-04T08:20:04.000Z.",
      },
    ]);
  });
});

describe("silentNetwork", () => {
  it("answers nothing until the signal aborts, then rejects with its reason", async () => {
    const controller = new AbortController();
    const reason = new DOMException("The operation timed out.", "TimeoutError");
    let settled = false;
    const response = silentNetwork(FAKE_WORKER_ORIGIN, {
      signal: controller.signal,
    }).finally(() => {
      settled = true;
    });
    await Promise.resolve();
    const settledBeforeAbort = settled;

    controller.abort(reason);

    await expect(response).rejects.toBe(reason);
    expect(settledBeforeAbort).toBe(false);
  });

  it.each([
    ["no options", undefined],
    ["options without a signal", {}],
  ])("answers nothing ever to a request with %s", async (_, init) => {
    let settled = false;
    void silentNetwork(FAKE_WORKER_ORIGIN, init).finally(() => {
      settled = true;
    });

    await Promise.resolve();

    expect(settled).toBe(false);
  });
});

describe("testTiming", () => {
  it("reads its fixed clock, draws a middling random number and never times out", () => {
    const now = new Date("2026-11-04T09:40:00Z");
    const timing = testTiming(now);

    expect([
      timing.now(),
      timing.random(),
      timing.timeout(1).aborted,
    ]).toStrictEqual([now, 0.5, false]);
  });

  it("waits no time, recording each wait it was asked for", async () => {
    const timing = testTiming(new Date());

    await timing.wait(500);
    await timing.wait(1000);

    expect(timing.waits).toStrictEqual([500, 1000]);
  });
});
