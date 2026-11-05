/**
 * @file The live data store: it starts from the initial data, which it keeps
 * for hydration, and tells each subscriber about every change until it
 * unsubscribes, reporting a subscriber that throws while the rest still hear.
 */

import { describe, expect, it, vi } from "vitest";

import { LiveDataStore } from "../../../../src/github-data/live/live-data-store.ts";
import { Clock } from "../../../../src/github-data/time/clock.ts";
import { baked } from "../../../fixtures/baked-github-data.ts";

const BAKED = {
  clock: new Clock(baked.bakedAt, "UTC"),
  freshness: "baked",
  snapshot: baked.snapshot,
} as const;

const LIVE = { ...BAKED, freshness: "live" } as const;

function unreported(error: unknown): never {
  throw new Error("The store reported an error no test expects.", {
    cause: error,
  });
}

describe("LiveDataStore", () => {
  it("reads the initial data until data is published, and keeps it after", () => {
    const store = new LiveDataStore(BAKED, unreported);
    const before = store.read();

    store.publish(LIVE);

    expect([before, store.read(), store.readInitial()]).toStrictEqual([
      BAKED,
      LIVE,
      BAKED,
    ]);
  });

  it("tells each subscriber about each change, until it unsubscribes", () => {
    const store = new LiveDataStore(BAKED, unreported);
    const [first, second] = [vi.fn(), vi.fn()];
    const unsubscribeFirst = store.subscribe(first);
    store.subscribe(second);

    store.publish(LIVE);
    unsubscribeFirst();
    store.publish(BAKED);

    expect([first.mock.calls.length, second.mock.calls.length]).toStrictEqual([
      1, 2,
    ]);
  });

  it("reports a subscriber that throws, and still tells the rest", () => {
    const thrown = new Error("A broken subscriber");
    const reported: unknown[] = [];
    const store = new LiveDataStore(BAKED, (error) => {
      reported.push(error);
    });
    const after = vi.fn();
    store.subscribe(() => {
      throw thrown;
    });
    store.subscribe(after);

    store.publish(LIVE);

    expect([reported, after.mock.calls.length]).toStrictEqual([[thrown], 1]);
  });
});
