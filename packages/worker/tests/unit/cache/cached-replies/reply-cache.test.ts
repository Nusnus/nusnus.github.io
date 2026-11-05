/**
 * @file The reply cache: a route's cached reply keyed by its path alone, kept
 * for days with its access headers, the instant its data was fetched and the
 * worker version that stored it, and read back as it was; a reply this worker
 * version stored read with no parsing; one another version stored checked
 * against the contract, and its fetch instant read from it; and one that
 * breaks the contract counted as none, with a warning of what broke.
 */

import { WORKER_ROUTES, WorkerReplyError } from "@nusnus/github-data/routes";
import { describe, expect, it, vi } from "vitest";

import { CachedReply } from "../../../../src/cache/cached-replies/cached-reply.ts";
import { ReplyCache } from "../../../../src/cache/cached-replies/reply-cache.ts";
import { freshCache } from "../../../fixtures/cache.ts";

const ORIGIN = "https://worker.test";
const WORKER_VERSION = "0e1f4789-4064-4773-80b2-67a5e0d3f1c2";
const PROFILE_BODY =
  '{"data":{"avatarUrl":"https://avatars.githubusercontent.com/u/4662342?v=4","followers":120},"fetchedAt":"2026-11-04T07:19:55.000Z"}';
const FETCHED_AT = new Date("2026-11-04T07:19:55Z");

// A reply stored with the given body and headers, as a worker version other
// than this one, or this one, may have stored it.
async function storedReply(
  body: string,
  headers: Readonly<Record<string, string>>,
): Promise<Cache> {
  const storage = await freshCache();
  await storage.put(
    `${ORIGIN}/profile`,
    new Response(body, {
      headers: { "Cache-Control": "max-age=60", ...headers },
    }),
  );
  return storage;
}

describe("ReplyCache.match", () => {
  it.each([null, "2023-04-26 23:23:18 +0200"])(
    "reads back the reply it stored, whose token expires %s",
    async (tokenExpiry) => {
      const cache = new ReplyCache(await freshCache(), ORIGIN, WORKER_VERSION);
      const cached = new CachedReply(PROFILE_BODY, FETCHED_AT, tokenExpiry);
      await cache.put(WORKER_ROUTES.profile, cached);

      await expect(cache.match(WORKER_ROUTES.profile)).resolves.toStrictEqual(
        cached,
      );
    },
  );

  it("reads a reply this worker version stored with no parsing", async () => {
    // A body no contract holds, which only parsing would refuse.
    const storage = await storedReply('{"status":"ok"}', {
      "Fetched-At": "2026-11-04T07:19:55.000Z",
      "Worker-Version": WORKER_VERSION,
    });

    await expect(
      new ReplyCache(storage, ORIGIN, WORKER_VERSION).match(
        WORKER_ROUTES.profile,
      ),
    ).resolves.toStrictEqual(
      new CachedReply('{"status":"ok"}', FETCHED_AT, null),
    );
  });

  it.each([
    {
      "Fetched-At": "2026-11-04T08:00:00.000Z",
      "Worker-Version": "an older version",
    },
    { "Worker-Version": WORKER_VERSION },
  ])(
    "checks a reply stored with the headers %j against the contract, reading when its data was fetched from it",
    async (headers) => {
      const storage = await storedReply(PROFILE_BODY, headers);

      await expect(
        new ReplyCache(storage, ORIGIN, WORKER_VERSION).match(
          WORKER_ROUTES.profile,
        ),
      ).resolves.toStrictEqual(new CachedReply(PROFILE_BODY, FETCHED_AT, null));
    },
  );

  it("counts a reply that no longer holds the contract as none, warning what broke", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    // A reply as a worker serving an older contract might have stored it.
    const storage = await storedReply(
      '{"data":{"avatarUrl":"https://avatars.githubusercontent.com/u/4662342?v=4","followers":120},"fetchedAt":"2026-11-04T07:19:55.000Z","status":"ok"}',
      { "Worker-Version": "an older version" },
    );

    await expect(
      new ReplyCache(storage, ORIGIN, WORKER_VERSION).match(
        WORKER_ROUTES.profile,
      ),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      "Ignoring the cached reply for /profile, stored in a shape the worker no longer reads.",
      new WorkerReplyError(
        "The worker's /profile reply breaks the github-data contract:\n" +
          '✖ Unrecognized key: "status"\n' +
          "Deploy the worker and the site from the same commit.",
      ),
    );
  });
});

describe("ReplyCache.put", () => {
  it("stores a route's reply for days under the route's path, with its access headers, when its data was fetched and the worker version", async () => {
    const storage = await freshCache();

    await new ReplyCache(storage, ORIGIN, WORKER_VERSION).put(
      WORKER_ROUTES.profile,
      new CachedReply(PROFILE_BODY, FETCHED_AT, "2023-04-26 23:23:18 +0200"),
    );

    const stored = await storage.match(`${ORIGIN}/profile`);
    expect([
      [
        "Cache-Control",
        "Fetched-At",
        "GitHub-Authentication-Token-Expiration",
        "Worker-Version",
        "X-GitHub-Api-Version",
      ].map((name) => stored?.headers.get(name)),
      await stored?.text(),
    ]).toStrictEqual([
      [
        "max-age=604800",
        "2026-11-04T07:19:55.000Z",
        "2023-04-26 23:23:18 +0200",
        WORKER_VERSION,
        "2026-03-10",
      ],
      PROFILE_BODY,
    ]);
  });
});

describe("ReplyCache.keyOf", () => {
  it("keys a route's reply by the worker's origin and the route's path", async () => {
    const cache = new ReplyCache(await freshCache(), ORIGIN, WORKER_VERSION);

    expect(cache.keyOf(WORKER_ROUTES.profile)).toBe(
      "https://worker.test/profile",
    );
  });
});
