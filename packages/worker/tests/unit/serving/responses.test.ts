/**
 * @file The worker's responses: a reply's JSON text sent as it is, open to
 * any origin, revalidated on every load, tagged by when its data was fetched,
 * saying how the cache answered, with a `ttl` that is negative once the reply
 * is stale, and carrying the access headers; a bodiless 304 when the
 * browser's copy is current; and errors that no one caches, among them a
 * route's data being unavailable, which says why and when the worker asks
 * GitHub again, in its text and in a Retry-After a page's script can read,
 * and a fault in the worker, which says what failed.
 */

import { WORKER_ROUTES } from "@nusnus/github-data/routes";
import { describe, expect, it } from "vitest";

import { Backoff } from "../../../src/cache/backoffs/backoff.ts";
import { CachedReply } from "../../../src/cache/cached-replies/cached-reply.ts";
import {
  cachedReplyResponse,
  errorResponse,
  faultResponse,
  fetchedReplyResponse,
  unavailableResponse,
} from "../../../src/serving/responses.ts";
import { FAULT_STEP } from "../../fixtures/next-steps.ts";

const PROFILE_BODY =
  '{"data":{"avatarUrl":"https://avatars.githubusercontent.com/u/4662342?v=4","followers":120},"fetchedAt":"2026-11-04T07:19:55.000Z"}';
const PROFILE = new CachedReply(
  PROFILE_BODY,
  new Date("2026-11-04T07:19:55Z"),
  null,
);

function requestWith(ifNoneMatch?: string): Request {
  return new Request(WORKER_ROUTES.profile.urlAt("https://worker.test"), {
    headers: ifNoneMatch === undefined ? {} : { "If-None-Match": ifNoneMatch },
  });
}

describe("cachedReplyResponse", () => {
  it.each([
    [42.9, "worker; hit; ttl=42"],
    [-0.5, "worker; hit; ttl=-1"],
  ])(
    "reports a cached reply with %f seconds to live as %s",
    (ttlSeconds, cacheStatus) => {
      expect(
        cachedReplyResponse(requestWith(), PROFILE, ttlSeconds).headers.get(
          "Cache-Status",
        ),
      ).toBe(cacheStatus);
    },
  );
});

describe("fetchedReplyResponse", () => {
  it("sends the reply's JSON text as it is, open to any origin, to revalidate on every load, tagged by when its data was fetched, with the API version the worker requests", async () => {
    const response = fetchedReplyResponse(requestWith(), PROFILE);

    expect([
      response.status,
      Object.fromEntries(response.headers),
      await response.text(),
    ]).toStrictEqual([
      200,
      {
        "access-control-allow-origin": "*",
        "cache-control": "no-cache",
        "cache-status": "worker; fwd=uri-miss; stored",
        "content-type": "application/json",
        etag: '"2026-11-04T07:19:55.000Z"',
        "x-github-api-version": "2026-03-10",
      },
      PROFILE_BODY,
    ]);
  });

  it("relays the expiry of the token that fetched the reply", () => {
    const response = fetchedReplyResponse(
      requestWith(),
      new CachedReply(
        PROFILE.body,
        PROFILE.fetchedAt,
        "2023-04-26 23:23:18 +0200",
      ),
    );

    expect(response.headers.get("GitHub-Authentication-Token-Expiration")).toBe(
      "2023-04-26 23:23:18 +0200",
    );
  });

  it.each([
    '"2026-11-04T07:19:55.000Z"',
    'W/"2026-11-04T07:19:55.000Z"',
    '"older", "2026-11-04T07:19:55.000Z"',
    "*",
  ])("answers If-None-Match: %s with a bodiless 304", async (ifNoneMatch) => {
    const response = fetchedReplyResponse(requestWith(ifNoneMatch), PROFILE);

    expect([
      response.status,
      response.headers.get("ETag"),
      await response.text(),
    ]).toStrictEqual([304, '"2026-11-04T07:19:55.000Z"', ""]);
  });

  it.each(['"2026-11-04T07:19:54.000Z"', '"W/2026-11-04T07:19:55.000Z"'])(
    "sends the reply when If-None-Match names another copy, %s",
    (ifNoneMatch) => {
      expect(
        fetchedReplyResponse(requestWith(ifNoneMatch), PROFILE).status,
      ).toBe(200);
    },
  );
});

describe("unavailableResponse", () => {
  it("answers 502, saying why the route's data is unavailable and when the worker asks GitHub again, in a Retry-After a page can read", async () => {
    const response = unavailableResponse(
      WORKER_ROUTES.profile,
      new Backoff(
        2,
        new Date("2026-11-04T12:01:30Z"),
        "GitHub answered GET /users/Nusnus with 503: ",
      ),
      new Date("2026-11-04T12:00:00Z"),
    );

    expect([
      response.status,
      response.headers.get("Retry-After"),
      response.headers.get("Access-Control-Expose-Headers"),
      await response.json(),
    ]).toStrictEqual([
      502,
      "90",
      "Retry-After",
      {
        error:
          "GitHub data for /profile is unavailable, and the worker has no cached reply to serve: GitHub answered GET /users/Nusnus with 503: \n" +
          "The worker asks GitHub again at 2026-11-04T12:01:30.000Z.",
      },
    ]);
  });
});

describe("faultResponse", () => {
  it("answers 500, naming the fault and saying to fix the worker", async () => {
    const response = faultResponse(new TypeError("route is undefined"));

    expect([response.status, await response.json()]).toStrictEqual([
      500,
      {
        error:
          "The worker failed to answer: TypeError: route is undefined\n" +
          FAULT_STEP,
      },
    ]);
  });
});

describe("errorResponse", () => {
  it("sends the error open to any origin, for no one to cache, with any extra headers", async () => {
    const response = errorResponse(405, "Use GET.", { Allow: "GET" });

    expect([
      response.status,
      Object.fromEntries(response.headers),
      await response.json(),
    ]).toStrictEqual([
      405,
      {
        "access-control-allow-origin": "*",
        allow: "GET",
        "cache-control": "no-store",
        "content-type": "application/json",
      },
      { error: "Use GET." },
    ]);
  });
});
