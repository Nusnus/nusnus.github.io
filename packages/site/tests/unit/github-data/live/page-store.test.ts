/**
 * @file The page's store starts from the baked snapshot, as a UTC clock stopped
 * at the moment it was baked reads it, is one store however often it is read,
 * and reports a subscriber's throw to the page; the page refreshes from the
 * worker origin the data was baked from.
 */

import {
  activityReply,
  contributionGraphReply,
  profileReply,
  repositoriesReply,
} from "@nusnus/github-data/fixtures/worker-replies";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  bakedWorkerOrigin,
  pageStore,
} from "../../../../src/github-data/live/page-store.ts";
import { encodeSnapshot } from "../../../../src/github-data/snapshot/snapshot.ts";
import { Clock } from "../../../../src/github-data/time/clock.ts";

afterEach(() => {
  pageStore().publish(pageStore().readInitial());
});

describe("pageStore", () => {
  it("starts from the baked snapshot, by the UTC clock of the moment it was baked", () => {
    const { snapshot, ...rest } = pageStore().readInitial();

    expect([rest, encodeSnapshot(snapshot)]).toStrictEqual([
      {
        clock: new Clock(new Date("2026-11-04T08:20:00Z"), "UTC"),
        freshness: "baked",
      },
      {
        activity: activityReply,
        contributionGraph: contributionGraphReply,
        profile: profileReply,
        repositories: repositoriesReply,
      },
    ]);
  });

  it("is one store, however often it is read", () => {
    expect(pageStore()).toBe(pageStore());
  });

  it("reports a subscriber's throw to the page", () => {
    const thrown = new Error("A broken subscriber");
    const reportError = vi.fn();
    vi.stubGlobal("reportError", reportError);
    const unsubscribe = pageStore().subscribe(() => {
      throw thrown;
    });

    pageStore().publish({ ...pageStore().read(), freshness: "live" });
    unsubscribe();

    expect(reportError.mock.calls).toStrictEqual([[thrown]]);
  });
});

describe("bakedWorkerOrigin", () => {
  it("is the worker the data was baked from", () => {
    expect(bakedWorkerOrigin()).toStrictEqual(
      new URL("https://worker.example/"),
    );
  });
});
