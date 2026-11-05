/**
 * @file The backoffs: a route's backoff stored beside its cached reply for
 * longer than its longest wait, read back as it was, and deleted on demand;
 * one stored in another shape counted as none, with a warning of what broke;
 * and one that breaks the shape refused when stored.
 */

import { WORKER_ROUTES } from "@nusnus/github-data/routes";
import { describe, expect, it, vi } from "vitest";

import { Backoff } from "../../../../src/cache/backoffs/backoff.ts";
import { Backoffs } from "../../../../src/cache/backoffs/backoffs.ts";
import { freshCache } from "../../../fixtures/cache.ts";
import { BACKOFF_SHAPE_STEP } from "../../../fixtures/next-steps.ts";

const BACKOFF = new Backoff(
  2,
  new Date("2026-11-04T12:01:30Z"),
  "GitHub answered GET /users/Nusnus with 503: ",
);

describe("Backoffs.match", () => {
  it("reads back the backoff it stored", async () => {
    const backoffs = new Backoffs(await freshCache(), "https://worker.test");
    await backoffs.put(WORKER_ROUTES.profile, BACKOFF);

    await expect(backoffs.match(WORKER_ROUTES.profile)).resolves.toStrictEqual(
      BACKOFF,
    );
  });

  it("counts a backoff stored in another shape as none, warning what broke", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const cache = await freshCache();
    // A shape the worker no longer writes, as a deploy that changed it leaves.
    await cache.put(
      "https://worker.test/backoff/profile",
      Response.json(
        { failures: 2, notBefore: "2026-11-04T12:01:30.000Z" },
        { headers: { "Cache-Control": "max-age=60" } },
      ),
    );

    await expect(
      new Backoffs(cache, "https://worker.test").match(WORKER_ROUTES.profile),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      "Ignoring the backoff for /profile, stored in a shape the worker no longer reads.",
      // The error's class is private to the module, so its fields stand in.
      expect.objectContaining({
        message:
          "The worker's backoff for /profile breaks the shape the worker stores backoffs in:\n" +
          "✖ Invalid input: expected string, received undefined\n  → at reason\n" +
          BACKOFF_SHAPE_STEP,
        name: "BackoffShapeError",
      }),
    );
  });
});

describe("Backoffs.put", () => {
  it("stores a route's backoff beside the route's cached reply, for longer than its longest wait", async () => {
    const cache = await freshCache();

    await new Backoffs(cache, "https://worker.test").put(
      WORKER_ROUTES.profile,
      BACKOFF,
    );

    const stored = await cache.match("https://worker.test/backoff/profile");
    expect([
      stored?.headers.get("Cache-Control"),
      await stored?.json(),
    ]).toStrictEqual([
      "max-age=86400",
      {
        failures: 2,
        notBefore: "2026-11-04T12:01:30.000Z",
        reason: "GitHub answered GET /users/Nusnus with 503: ",
      },
    ]);
  });

  it("refuses to store a backoff that breaks its shape", async () => {
    await expect(
      new Backoffs(await freshCache(), "https://worker.test").put(
        WORKER_ROUTES.profile,
        new Backoff(0, BACKOFF.notBefore, BACKOFF.reason),
      ),
    ).rejects.toThrow(
      // The error's class is private to the module, so its fields stand in.
      expect.objectContaining({
        message:
          "The worker's backoff for /profile breaks the shape the worker stores backoffs in:\n" +
          "✖ Too small: expected number to be >0\n  → at failures\n" +
          BACKOFF_SHAPE_STEP,
        name: "BackoffShapeError",
      }),
    );
  });
});

describe("Backoffs.delete", () => {
  it("deletes a route's backoff", async () => {
    const backoffs = new Backoffs(await freshCache(), "https://worker.test");
    await backoffs.put(WORKER_ROUTES.profile, BACKOFF);

    await backoffs.delete(WORKER_ROUTES.profile);

    await expect(
      backoffs.match(WORKER_ROUTES.profile),
    ).resolves.toBeUndefined();
  });
});
