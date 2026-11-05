/**
 * @file A route store: a route's value stored as JSON text under the worker's
 * origin, its key's prefix and the route's path, kept for the store's days
 * with any headers given, read back, and deleted; none for a route never
 * stored; one in an old shape counted as none, with a warning; and any other
 * failure to read one escaping.
 */

import { WORKER_ROUTES } from "@nusnus/github-data/routes";
import { describe, expect, it, vi } from "vitest";

import { RouteStore } from "../../../src/cache/route-store.ts";
import { freshCache } from "../../fixtures/cache.ts";

/** A value stored in a shape the store's reader no longer reads. */
class OldShapeError extends Error {
  override name = "OldShapeError";
}

function storeIn(cache: Cache): RouteStore {
  return new RouteStore(cache, "https://worker.test", {
    keyPrefix: "/stars",
    name: "star count",
    retentionDays: 2,
    isOldShape: (error) => error instanceof OldShapeError,
  });
}

async function readStars(stored: Response): Promise<unknown> {
  return stored.json();
}

describe("RouteStore.match", () => {
  it("reads back the value it stored", async () => {
    const store = storeIn(await freshCache());
    await store.put(WORKER_ROUTES.profile, '{"stars":29133}');

    await expect(
      store.match(WORKER_ROUTES.profile, readStars),
    ).resolves.toStrictEqual({ stars: 29_133 });
  });

  it("has no value for a route it never stored one for", async () => {
    const store = storeIn(await freshCache());

    await expect(
      store.match(WORKER_ROUTES.profile, readStars),
    ).resolves.toBeUndefined();
  });

  it("counts a value in an old shape as none, warning which and why", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const store = storeIn(await freshCache());
    await store.put(WORKER_ROUTES.profile, '{"stars":"many"}');

    await expect(
      store.match(WORKER_ROUTES.profile, () =>
        Promise.reject(new OldShapeError("stars must be a number")),
      ),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      "Ignoring the star count for /profile, stored in a shape the worker no longer reads.",
      new OldShapeError("stars must be a number"),
    );
  });

  it("lets any other failure to read a value escape", async () => {
    const store = storeIn(await freshCache());
    await store.put(WORKER_ROUTES.profile, '{"stars":29133}');

    await expect(
      store.match(WORKER_ROUTES.profile, () =>
        Promise.reject(new RangeError("a fault in the reader")),
      ),
    ).rejects.toThrow(new RangeError("a fault in the reader"));
  });
});

describe("RouteStore.put", () => {
  it("stores a route's value as JSON text for the store's days, with the headers given", async () => {
    const cache = await freshCache();
    const store = storeIn(cache);

    await store.put(WORKER_ROUTES.profile, '{"stars":29133}', { ETag: '"1"' });

    const stored = await cache.match("https://worker.test/stars/profile");
    expect([
      ["Cache-Control", "Content-Type", "ETag"].map((name) =>
        stored?.headers.get(name),
      ),
      await stored?.json(),
    ]).toStrictEqual([
      ["max-age=172800", "application/json", '"1"'],
      { stars: 29_133 },
    ]);
  });
});

describe("RouteStore.delete", () => {
  it("deletes a route's value", async () => {
    const store = storeIn(await freshCache());
    await store.put(WORKER_ROUTES.profile, '{"stars":29133}');

    await store.delete(WORKER_ROUTES.profile);

    await expect(
      store.match(WORKER_ROUTES.profile, readStars),
    ).resolves.toBeUndefined();
  });
});

describe("RouteStore.keyOf", () => {
  it("keys a route's value by the worker's origin, the store's prefix and the route's path", async () => {
    const store = storeIn(await freshCache());

    expect(store.keyOf(WORKER_ROUTES.profile)).toBe(
      "https://worker.test/stars/profile",
    );
  });
});
