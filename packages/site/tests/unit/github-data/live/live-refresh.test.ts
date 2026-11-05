/**
 * @file The live refresh: on start it switches the page to the visitor's clock
 * and refreshes from the worker, then refreshes whenever the tab becomes
 * visible and every five minutes while it is visible, one refresh at a time.
 * Each result is live when every route answered and stale, keeping the failed
 * routes' previous replies and warning why, when some did not; after each
 * stale result in a row, it waits twice as long, jittered, up to an hour, and
 * never sooner than a failed route's response asked to be retried; the page's
 * live texts follow each result; and an unexpected error is reported.
 */

import {
  activityReply,
  contributionGraphReply,
  profileReply,
  repositoriesReply,
} from "@nusnus/github-data/fixtures/worker-replies";
import { WORKER_ROUTES } from "@nusnus/github-data/routes";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  type LiveData,
  LiveDataStore,
} from "../../../../src/github-data/live/live-data-store.ts";
import { LiveRefresh } from "../../../../src/github-data/live/live-refresh.ts";
import { pageStore } from "../../../../src/github-data/live/page-store.ts";
import {
  type EncodedSnapshot,
  encodeSnapshot,
} from "../../../../src/github-data/snapshot/snapshot.ts";
import { WorkerClient } from "../../../../src/github-data/snapshot/worker-client.ts";
import { Clock } from "../../../../src/github-data/time/clock.ts";
import { baked } from "../../../fixtures/baked-github-data.ts";
import {
  FAKE_WORKER_ORIGIN,
  testTiming,
  workerNetwork,
  workerNotFound,
  workerUnavailable,
} from "../../../fixtures/worker/network.ts";

const NOW = new Date("2026-11-04T09:40:00Z");
const VISITOR_CLOCK = new Clock(NOW, "Asia/Jerusalem");
// When the worker fetched the replies it serves now.
const LATER = "2026-11-04T09:38:00.000Z";
const MINUTE_MS = 60 * 1000;

// The worker's recorded replies as a later fetch would bring them, by when
// Tomer's followers grew to 121: no later fetch can be recorded on demand, so
// these edit the recorded ones by hand.
const LATER_ENCODED: EncodedSnapshot = {
  activity: { ...activityReply, fetchedAt: LATER },
  contributionGraph: { ...contributionGraphReply, fetchedAt: LATER },
  profile: {
    data: { ...profileReply.data, followers: 121 },
    fetchedAt: LATER,
  },
  repositories: { ...repositoriesReply, fetchedAt: LATER },
};

const LATER_REPLIES: Record<string, unknown> = {
  [WORKER_ROUTES.activity.path]: LATER_ENCODED.activity,
  [WORKER_ROUTES.contributionGraph.path]: LATER_ENCODED.contributionGraph,
  [WORKER_ROUTES.profile.path]: LATER_ENCODED.profile,
  [WORKER_ROUTES.repositories.path]: LATER_ENCODED.repositories,
};

const BAKED: LiveData = {
  clock: new Clock(baked.bakedAt, "UTC"),
  freshness: "baked",
  snapshot: baked.snapshot,
};

let visibility: DocumentVisibilityState = "visible";
let refreshes: LiveRefresh[] = [];

function laterNetwork(failing: readonly string[] = []) {
  return workerNetwork({
    failing: Object.fromEntries(failing.map((path) => [path, workerNotFound])),
    replies: LATER_REPLIES,
  });
}

function startRefresh(
  store: LiveDataStore,
  network: typeof fetch,
  reportError: (error: unknown) => void = (error) => {
    throw error;
  },
): LiveRefresh {
  const refresh = new LiveRefresh({
    reportError,
    store,
    window,
    worker: new WorkerClient(FAKE_WORKER_ORIGIN, network, testTiming(NOW)),
    random: () => 0.5,
    visitorClock: () => VISITOR_CLOCK,
  });
  refreshes.push(refresh);
  refresh.start();
  return refresh;
}

function newStore(): LiveDataStore {
  return new LiveDataStore(BAKED, (error) => {
    throw error;
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  visibility = "visible";
  vi.spyOn(document, "visibilityState", "get").mockImplementation(
    () => visibility,
  );
  document.body.innerHTML = "";
});

afterEach(() => {
  for (const refresh of refreshes) {
    refresh.stop();
  }
  refreshes = [];
  pageStore().publish(pageStore().readInitial());
  vi.useRealTimers();
});

describe("LiveRefresh", () => {
  it("attaches to the page's store and refreshes it from the worker it was baked from", async () => {
    vi.useFakeTimers({
      now: NOW,
      toFake: ["Date", "setTimeout", "clearTimeout"],
    });
    const network = vi
      .spyOn(window, "fetch")
      .mockImplementation(laterNetwork());

    const refresh = LiveRefresh.attach(window);
    refreshes.push(refresh);
    const clockOnAttach = pageStore().read().clock;
    await refresh.refresh();

    expect([
      clockOnAttach.now,
      network.mock.calls.map(([input]) => new Request(input).url).toSorted(),
      encodeSnapshot(pageStore().read().snapshot),
    ]).toStrictEqual([
      NOW,
      [
        "https://worker.example/activity",
        "https://worker.example/contribution-graph",
        "https://worker.example/profile",
        "https://worker.example/repositories",
      ],
      LATER_ENCODED,
    ]);
  });

  it("attached, reports an unexpected error from a refresh to the page", async () => {
    const bug = new RangeError("a bug in the network layer");
    vi.spyOn(window, "fetch").mockRejectedValue(bug);
    const reportError = vi.fn();
    vi.stubGlobal("reportError", reportError);

    refreshes.push(LiveRefresh.attach(window));
    await vi.advanceTimersByTimeAsync(0);

    expect(reportError.mock.calls).toStrictEqual([[bug]]);
  });

  it("switches the page to the visitor's clock as it starts, before any reply", () => {
    const store = newStore();

    startRefresh(store, laterNetwork());

    expect(store.read()).toStrictEqual({ ...BAKED, clock: VISITOR_CLOCK });
  });

  it("publishes the worker's replies as live data", async () => {
    const store = newStore();

    await startRefresh(store, laterNetwork()).refresh();
    const { snapshot, ...rest } = store.read();

    expect([rest, encodeSnapshot(snapshot)]).toStrictEqual([
      { clock: VISITOR_CLOCK, freshness: "live" },
      LATER_ENCODED,
    ]);
  });

  it("keeps a failed route's previous reply, marks the data stale and warns why", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const store = newStore();

    await startRefresh(store, laterNetwork(["/profile"])).refresh();
    const { snapshot, ...rest } = store.read();

    expect([rest, encodeSnapshot(snapshot), warn.mock.calls]).toStrictEqual([
      { clock: VISITOR_CLOCK, freshness: "stale" },
      { ...LATER_ENCODED, profile: profileReply },
      [
        [
          "Live GitHub data is unavailable, so the page shows older data: The worker answered https://worker.example/profile with HTTP 404; it says: The worker has no route at /no-such-route; it serves /activity, /contribution-graph, /profile, /repositories.",
        ],
      ],
    ]);
  });

  it("keeps the page's live texts in step with the data, by the visitor's clock", async () => {
    document.body.innerHTML = '<span data-live="lastUpdated">1 hour ago</span>';

    const refresh = startRefresh(newStore(), laterNetwork());
    const beforeReply = document.body.textContent;
    await refresh.refresh();

    expect([beforeReply, document.body.textContent]).toStrictEqual([
      "2 hours ago",
      "2 minutes ago",
    ]);
  });

  it("joins the refresh under way rather than starting another", async () => {
    const network = laterNetwork();
    const refresh = startRefresh(newStore(), network);

    await Promise.all([refresh.refresh(), refresh.refresh()]);
    await refresh.refresh();

    expect(network).toHaveBeenCalledTimes(8);
  });

  it("refreshes five minutes after a live refresh while the tab is visible", async () => {
    const network = laterNetwork();
    await startRefresh(newStore(), network).refresh();

    await vi.advanceTimersByTimeAsync(5 * MINUTE_MS - 1);
    const beforeFiveMinutes = network.mock.calls.length;
    await vi.advanceTimersByTimeAsync(1);

    expect([beforeFiveMinutes, network.mock.calls.length]).toStrictEqual([
      4, 8,
    ]);
  });

  it("skips the timed refresh while the tab is hidden, and tries again five minutes later", async () => {
    const network = laterNetwork();
    await startRefresh(newStore(), network).refresh();
    visibility = "hidden";

    await vi.advanceTimersByTimeAsync(5 * MINUTE_MS);
    const whileHidden = network.mock.calls.length;
    visibility = "visible";
    await vi.advanceTimersByTimeAsync(5 * MINUTE_MS);

    expect([whileHidden, network.mock.calls.length]).toStrictEqual([4, 8]);
  });

  it("waits twice as long after each stale refresh in a row, jittered to three quarters, up to an hour", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const network = laterNetwork(["/profile"]);
    await startRefresh(newStore(), network).refresh();
    const waits: number[] = [];

    for (const minutes of [7.5, 15, 30, 45, 45]) {
      const before = network.mock.calls.length;
      await vi.advanceTimersByTimeAsync(minutes * MINUTE_MS - 1);
      const early = network.mock.calls.length;
      await vi.advanceTimersByTimeAsync(1);
      waits.push(early - before, network.mock.calls.length - before);
    }

    expect(waits).toStrictEqual([0, 4, 0, 4, 0, 4, 0, 4, 0, 4]);
  });

  it("waits until the worker asks to be retried when that is later than its backoff, whatever else failed", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    // The worker's recorded 502 asks to be retried in 3599 seconds, later
    // than the first backoff; its 404, and a reply that breaks the contract,
    // ask for no time.
    const network = workerNetwork({
      failing: { "/activity": workerNotFound, "/profile": workerUnavailable },
      replies: {
        ...LATER_REPLIES,
        // Only a worker deployed from another commit sends a reply that
        // breaks the contract, which cannot be recorded on demand.
        [WORKER_ROUTES.repositories.path]: { data: {} },
      },
    });
    await startRefresh(newStore(), network).refresh();

    await vi.advanceTimersByTimeAsync(3599 * 1000 - 1);
    const early = network.mock.calls.length;
    await vi.advanceTimersByTimeAsync(1);

    expect([early, network.mock.calls.length]).toStrictEqual([4, 8]);
  });

  it("waits five minutes again once a refresh is live", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const failing: Record<string, () => Promise<Response>> = {
      "/profile": workerNotFound,
    };
    const network = workerNetwork({ failing, replies: LATER_REPLIES });
    await startRefresh(newStore(), network).refresh();
    delete failing["/profile"];

    await vi.advanceTimersByTimeAsync(7.5 * MINUTE_MS);
    const afterRecovery = network.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5 * MINUTE_MS);

    expect([
      warn.mock.calls.length,
      afterRecovery,
      network.mock.calls.length,
    ]).toStrictEqual([1, 8, 12]);
  });

  it("refreshes when the tab becomes visible, but not when it is hidden", async () => {
    const network = laterNetwork();
    await startRefresh(newStore(), network).refresh();

    visibility = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    const whenHidden = network.mock.calls.length;
    visibility = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);

    expect([whenHidden, network.mock.calls.length]).toStrictEqual([4, 8]);
  });

  it("waits five minutes from the latest refresh, whatever started it", async () => {
    const network = laterNetwork();
    await startRefresh(newStore(), network).refresh();

    await vi.advanceTimersByTimeAsync(2 * MINUTE_MS);
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(3 * MINUTE_MS);
    const atFiveMinutes = network.mock.calls.length;
    await vi.advanceTimersByTimeAsync(2 * MINUTE_MS);

    expect([atFiveMinutes, network.mock.calls.length]).toStrictEqual([8, 12]);
  });

  it("stops refreshing and following the data once stopped", async () => {
    document.body.innerHTML = '<span data-live="lastUpdated">1 hour ago</span>';
    const network = laterNetwork();
    const store = newStore();
    const refresh = startRefresh(store, network);
    await refresh.refresh();

    refresh.stop();
    store.publish(BAKED);
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(60 * MINUTE_MS);

    expect([
      network.mock.calls.length,
      document.body.textContent,
    ]).toStrictEqual([4, "2 minutes ago"]);
  });

  it("publishes a refresh under way when stopped, and schedules none after it", async () => {
    const network = laterNetwork();
    const store = newStore();
    const refresh = startRefresh(store, network);
    const underWay = refresh.refresh();

    refresh.stop();
    await underWay;
    await vi.advanceTimersByTimeAsync(60 * MINUTE_MS);

    expect([store.read().freshness, network.mock.calls.length]).toStrictEqual([
      "live",
      4,
    ]);
  });

  it("reports an unexpected error from a refresh it starts", async () => {
    const bug = new RangeError("a bug in the network layer");
    const reported: unknown[] = [];

    startRefresh(
      newStore(),
      () => Promise.reject(bug),
      (error) => {
        reported.push(error);
      },
    );
    await vi.advanceTimersByTimeAsync(0);

    expect(reported).toStrictEqual([bug]);
  });
});
