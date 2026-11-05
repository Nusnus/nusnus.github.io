/**
 * @file The route server, serving stale-while-revalidate: a route with no
 * cached reply is fetched, stamped with when its data arrived, and stored with
 * its token's expiry; a fresh reply is served without GitHub; a stale reply is
 * served at once while one background refresh, per lease, replaces it; a
 * failed fetch keeps any stale reply, answers 502 when there is none, saying
 * when the worker asks again, and sets the route's backoff, which grows with
 * each failure in a row, keeps to the instant GitHub asks for, holds back every
 * fetch until it ends, and clears once a fetch succeeds; a fault in the worker
 * sets the backoff as GitHub's failures do; and a fetch's deadline leaves time
 * within the background limit to store what it fetched.
 */

import { profileReply } from "@nusnus/github-data/fixtures/worker-replies";
import {
  WORKER_FETCH_DEADLINE_MS,
  WORKER_ROUTES,
  WorkerReplyError,
} from "@nusnus/github-data/routes";
import { describe, expect, it, vi } from "vitest";

import type { RouteSource } from "../../../src/routes/route-source.ts";

import { Backoff } from "../../../src/cache/backoffs/backoff.ts";
import { Backoffs } from "../../../src/cache/backoffs/backoffs.ts";
import { CachedReply } from "../../../src/cache/cached-replies/cached-reply.ts";
import { ReplyCache } from "../../../src/cache/cached-replies/reply-cache.ts";
import { RefreshLeases } from "../../../src/cache/refresh-leases.ts";
import { profileSource } from "../../../src/routes/profile.ts";
import { RouteServer } from "../../../src/serving/server.ts";
import { freshCache } from "../../fixtures/cache.ts";
import {
  receivedRequests,
  recorded,
  replayGitHub,
  testClient,
  useFakeGitHub,
  withExpiringToken,
} from "../../fixtures/github/fake.ts";
import { REFUSED_TOKEN_STEP } from "../../fixtures/next-steps.ts";

useFakeGitHub();

// When the profile source's fresh window ends, after `profileReply` was
// fetched.
const PROFILE_GOES_STALE_AT = new Date("2026-11-04T07:29:55Z");
const NOW = new Date("2026-11-04T12:00:00Z");
const ORIGIN = "https://worker.test";
const REFUSED_TOKEN =
  'GitHub answered GET /users/Nusnus with 401: {"message":"Bad credentials","documentation_url":"https://docs.github.com/rest","status":"401"}\n' +
  REFUSED_TOKEN_STEP;
const STALE_PROFILE = new CachedReply(
  '{"data":{"avatarUrl":"https://avatars.githubusercontent.com/u/4662342?v=4","followers":120},"fetchedAt":"2026-11-04T07:19:55.000Z"}',
  new Date("2026-11-04T07:19:55Z"),
  null,
);
const FETCHED_PROFILE = {
  data: profileReply.data,
  fetchedAt: "2026-11-04T12:00:00.000Z",
};
const CACHED_FETCHED_PROFILE = new CachedReply(
  '{"data":{"avatarUrl":"https://avatars.githubusercontent.com/u/4662342?v=4","followers":120},"fetchedAt":"2026-11-04T12:00:00.000Z"}',
  NOW,
  null,
);

async function serverAt(now: Date) {
  const storage = await freshCache();
  const cache = new ReplyCache(
    storage,
    ORIGIN,
    "0e1f4789-4064-4773-80b2-67a5e0d3f1c2",
  );
  const backoffs = new Backoffs(storage, ORIGIN);
  const background: Promise<unknown>[] = [];
  const deadlines: number[] = [];
  const server = new RouteServer({
    backoffs,
    cache,
    leases: new RefreshLeases(30_000),
    createGitHubClient: (deadlineMs) => {
      deadlines.push(deadlineMs);
      return testClient({ deadlineMs, startAt: now }).github;
    },
    now: () => now,
    random: () => 0.5,
    waitUntil: (promise) => {
      background.push(promise);
    },
  });
  return { background, backoffs, cache, deadlines, server };
}

async function serveProfile(
  server: RouteServer,
  source: RouteSource<unknown> = profileSource,
): Promise<[number, null | string, null | string, unknown]> {
  const response = await server.serve(
    source,
    new Request(WORKER_ROUTES.profile.urlAt(ORIGIN)),
  );
  return [
    response.status,
    response.headers.get("Cache-Status"),
    response.headers.get("Retry-After"),
    await response.json(),
  ];
}

describe("RouteServer.BACKGROUND_LIMIT_MS", () => {
  it("is the 30 seconds the Workers runtime lets work go on after a response", () => {
    expect(RouteServer.BACKGROUND_LIMIT_MS).toBe(30_000);
  });

  it("leaves five seconds past the contract's fetch deadline to store what a fetch fetched", () => {
    expect(RouteServer.BACKGROUND_LIMIT_MS - WORKER_FETCH_DEADLINE_MS).toBe(
      5000,
    );
  });
});

describe("RouteServer.serve", () => {
  it("fetches a route it has no cached reply of, within the worker's deadline, and stores the reply", async () => {
    replayGitHub(recorded("rest/users/Nusnus"));
    const { background, cache, deadlines, server } = await serverAt(NOW);

    const served = await serveProfile(server);
    await Promise.all(background);

    expect([
      served,
      deadlines,
      await cache.match(WORKER_ROUTES.profile),
    ]).toStrictEqual([
      [200, "worker; fwd=uri-miss; stored", null, FETCHED_PROFILE],
      [25_000],
      CACHED_FETCHED_PROFILE,
    ]);
  });

  it("serves and stores the expiry GitHub reported for the token that fetched the reply", async () => {
    replayGitHub(withExpiringToken(recorded("rest/users/Nusnus")));
    const { background, cache, server } = await serverAt(NOW);

    const response = await server.serve(
      profileSource,
      new Request(WORKER_ROUTES.profile.urlAt(ORIGIN)),
    );
    await Promise.all(background);

    expect([
      response.headers.get("GitHub-Authentication-Token-Expiration"),
      (await cache.match(WORKER_ROUTES.profile))?.tokenExpiry,
    ]).toStrictEqual([
      "2023-04-26 23:23:18 +0200",
      "2023-04-26 23:23:18 +0200",
    ]);
  });

  it("serves a fresh reply without asking GitHub", async () => {
    const { background, cache, server } = await serverAt(
      new Date(PROFILE_GOES_STALE_AT.getTime() - 1000),
    );
    await cache.put(WORKER_ROUTES.profile, STALE_PROFILE);

    expect([
      await serveProfile(server),
      background,
      receivedRequests(),
    ]).toStrictEqual([[200, "worker; hit; ttl=1", null, profileReply], [], []]);
  });

  it("serves a stale reply at once, and replaces it in the background", async () => {
    replayGitHub(recorded("rest/users/Nusnus"));
    const { background, cache, server } = await serverAt(NOW);
    await cache.put(WORKER_ROUTES.profile, STALE_PROFILE);

    const served = await serveProfile(server);
    await Promise.all(background);

    expect([served, await cache.match(WORKER_ROUTES.profile)]).toStrictEqual([
      [200, "worker; hit; ttl=-16205", null, profileReply],
      CACHED_FETCHED_PROFILE,
    ]);
  });

  it("counts a reply as stale from the moment its fresh window ends", async () => {
    replayGitHub(recorded("rest/users/Nusnus"));
    const { background, cache, server } = await serverAt(PROFILE_GOES_STALE_AT);
    await cache.put(WORKER_ROUTES.profile, STALE_PROFILE);

    await serveProfile(server);
    await Promise.all(background);

    expect(background.length).toBe(1);
  });

  it("starts one background refresh, however many requests find the reply stale while its lease holds", async () => {
    replayGitHub(recorded("rest/users/Nusnus"));
    const { background, cache, server } = await serverAt(NOW);
    await cache.put(WORKER_ROUTES.profile, STALE_PROFILE);

    await Promise.all([serveProfile(server), serveProfile(server)]);
    await Promise.all(background);

    expect([background.length, receivedRequests().length]).toStrictEqual([
      1, 1,
    ]);
  });

  it("keeps the stale reply, backs off and logs why, when a refresh fails", async () => {
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    replayGitHub(recorded("rest/users/Nusnus.unauthorized"));
    const { background, backoffs, cache, server } = await serverAt(NOW);
    await cache.put(WORKER_ROUTES.profile, STALE_PROFILE);

    await serveProfile(server);
    await Promise.all(background);

    expect([
      await cache.match(WORKER_ROUTES.profile),
      await backoffs.match(WORKER_ROUTES.profile),
    ]).toStrictEqual([
      STALE_PROFILE,
      new Backoff(1, new Date("2026-11-04T12:00:45Z"), REFUSED_TOKEN),
    ]);
    expect(error).toHaveBeenCalledExactlyOnceWith(
      "Fetching /profile's data failed; the worker asks GitHub again at 2026-11-04T12:00:45.000Z:",
      expect.objectContaining({
        kind: "refused",
        message: REFUSED_TOKEN,
        name: "GitHubError",
      }),
    );
  });

  it("answers 502, saying when the worker asks again, and backs off, when GitHub fails and there is no cached reply", async () => {
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    replayGitHub(recorded("rest/users/Nusnus.unauthorized"));
    const { background, backoffs, server } = await serverAt(NOW);

    const served = await serveProfile(server);
    await Promise.all(background);

    expect(error).toHaveBeenCalledExactlyOnceWith(
      "Fetching /profile's data failed; the worker asks GitHub again at 2026-11-04T12:00:45.000Z:",
      expect.objectContaining({
        kind: "refused",
        message: REFUSED_TOKEN,
        name: "GitHubError",
      }),
    );
    expect([served, await backoffs.match(WORKER_ROUTES.profile)]).toStrictEqual(
      [
        [
          502,
          null,
          "45",
          {
            error:
              `GitHub data for /profile is unavailable, and the worker has no cached reply to serve: ${REFUSED_TOKEN}\n` +
              "The worker asks GitHub again at 2026-11-04T12:00:45.000Z.",
          },
        ],
        new Backoff(1, new Date("2026-11-04T12:00:45Z"), REFUSED_TOKEN),
      ],
    );
  });

  it("backs off longer after each failure in a row", async () => {
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    replayGitHub(recorded("rest/users/Nusnus.unauthorized"));
    const { background, backoffs, server } = await serverAt(NOW);
    await backoffs.put(
      WORKER_ROUTES.profile,
      new Backoff(1, NOW, REFUSED_TOKEN),
    );

    await serveProfile(server);
    await Promise.all(background);

    expect(error).toHaveBeenCalledExactlyOnceWith(
      "Fetching /profile's data failed; the worker asks GitHub again at 2026-11-04T12:01:30.000Z:",
      expect.objectContaining({
        kind: "refused",
        message: REFUSED_TOKEN,
        name: "GitHubError",
      }),
    );
    expect(await backoffs.match(WORKER_ROUTES.profile)).toStrictEqual(
      new Backoff(2, new Date("2026-11-04T12:01:30Z"), REFUSED_TOKEN),
    );
  });

  it("answers 502 while the route's backoff lasts, without asking GitHub", async () => {
    replayGitHub(recorded("rest/users/Nusnus"));
    const { backoffs, server } = await serverAt(NOW);
    await backoffs.put(
      WORKER_ROUTES.profile,
      new Backoff(1, new Date(NOW.getTime() + 1), REFUSED_TOKEN),
    );

    expect([await serveProfile(server), receivedRequests()]).toStrictEqual([
      [
        502,
        null,
        "1",
        {
          error:
            `GitHub data for /profile is unavailable, and the worker has no cached reply to serve: ${REFUSED_TOKEN}\n` +
            "The worker asks GitHub again at 2026-11-04T12:00:00.001Z.",
        },
      ],
      [],
    ]);
  });

  it("refreshes no stale reply while the route's backoff lasts", async () => {
    replayGitHub(recorded("rest/users/Nusnus"));
    const { background, backoffs, cache, server } = await serverAt(NOW);
    await cache.put(WORKER_ROUTES.profile, STALE_PROFILE);
    await backoffs.put(
      WORKER_ROUTES.profile,
      new Backoff(1, new Date(NOW.getTime() + 1), REFUSED_TOKEN),
    );

    await serveProfile(server);
    await Promise.all(background);

    expect([
      receivedRequests(),
      await cache.match(WORKER_ROUTES.profile),
    ]).toStrictEqual([[], STALE_PROFILE]);
  });

  it("asks GitHub again once the backoff ends, and clears it when GitHub answers", async () => {
    replayGitHub(recorded("rest/users/Nusnus"));
    const { background, backoffs, server } = await serverAt(NOW);
    await backoffs.put(
      WORKER_ROUTES.profile,
      new Backoff(1, NOW, REFUSED_TOKEN),
    );

    const [status] = await serveProfile(server);
    await Promise.all(background);

    expect([status, await backoffs.match(WORKER_ROUTES.profile)]).toStrictEqual(
      [200, undefined],
    );
  });

  describe("given a route whose data breaks the contract", () => {
    // A stand-in for a mapping bug, which the worker's own schemas of
    // GitHub's replies keep any recorded reply from causing.
    const brokenSource: RouteSource<unknown> = {
      ...profileSource,
      fetchData: () =>
        Promise.resolve({
          avatarUrl: "https://example.com/avatar.png",
          followers: 120,
        }),
    };
    const brokenReply = new WorkerReplyError(
      "The worker built a /profile reply that breaks the github-data contract:\n" +
        '✖ Invalid string: must start with "https://avatars.githubusercontent.com/"\n' +
        "  → at data.avatarUrl\n" +
        "Fix how the worker's route source for /profile builds it.",
    );
    const brokenReason = `WorkerReplyError: ${brokenReply.message}`;

    it("answers 502 with the fault, and backs off, when there is no cached reply", async () => {
      const error = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      const { background, backoffs, server } = await serverAt(NOW);

      const served = await serveProfile(server, brokenSource);
      await Promise.all(background);

      expect(error).toHaveBeenCalledExactlyOnceWith(
        "Fetching /profile's data failed; the worker asks GitHub again at 2026-11-04T12:00:45.000Z:",
        brokenReply,
      );
      expect([
        served,
        await backoffs.match(WORKER_ROUTES.profile),
      ]).toStrictEqual([
        [
          502,
          null,
          "45",
          {
            error:
              `GitHub data for /profile is unavailable, and the worker has no cached reply to serve: ${brokenReason}\n` +
              "The worker asks GitHub again at 2026-11-04T12:00:45.000Z.",
          },
        ],
        new Backoff(1, new Date("2026-11-04T12:00:45Z"), brokenReason),
      ]);
    });

    it("keeps the stale reply, and backs off, when a refresh meets the fault", async () => {
      const error = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      const { background, backoffs, cache, server } = await serverAt(NOW);
      await cache.put(WORKER_ROUTES.profile, STALE_PROFILE);

      await serveProfile(server, brokenSource);
      await Promise.all(background);

      expect(error).toHaveBeenCalledExactlyOnceWith(
        "Fetching /profile's data failed; the worker asks GitHub again at 2026-11-04T12:00:45.000Z:",
        brokenReply,
      );
      expect([
        await cache.match(WORKER_ROUTES.profile),
        await backoffs.match(WORKER_ROUTES.profile),
      ]).toStrictEqual([
        STALE_PROFILE,
        new Backoff(1, new Date("2026-11-04T12:00:45Z"), brokenReason),
      ]);
    });
  });
});
