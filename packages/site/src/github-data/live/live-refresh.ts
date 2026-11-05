/**
 * @file The live refresh. In the browser, it refreshes the page's data from the
 * worker on load, whenever the tab becomes visible again, and every
 * `LiveRefresh.INTERVAL_MS` while it is visible, one refresh at a time. It
 * publishes each result to the page's store: live when every route answered,
 * or stale, with each failed route's previous reply, when some did not,
 * warning in the console why. And it keeps the page's live texts in step with
 * the store, read by the visitor's clock.
 */

import { exponentialBackoffMs } from "@nusnus/github-data/retries";

import type { LiveDataStore } from "./live-data-store.ts";

import {
  SYSTEM_TIMING,
  WorkerClient,
  WorkerFetchError,
} from "../snapshot/worker-client.ts";
import { Clock } from "../time/clock.ts";
import { patchLiveTexts } from "./live-text.ts";
import { bakedWorkerOrigin, pageStore } from "./page-store.ts";

/**
 * What a live refresh works with: the page's store and window, the worker, the
 * visitor's clock, the random source that spreads its waits, and where an
 * unexpected error is reported.
 */
export interface LiveRefreshDependencies {
  readonly store: LiveDataStore;
  readonly window: Window;
  readonly worker: WorkerClient;
  readonly random: () => number;
  readonly reportError: (error: unknown) => void;
  readonly visitorClock: () => Clock;
}

/**
 * Keeps the page's data and its live texts in step with the worker while the
 * page is open. After each failed refresh in a row it doubles the wait before
 * the next, up to `MAX_INTERVAL_MS`, jittered so that pages which failed
 * together do not retry together, and never sooner than a failed route's
 * response asked to be retried; a live refresh resets the wait. Once stopped,
 * it starts no refresh, though one under way still publishes.
 */
export class LiveRefresh {
  static readonly INTERVAL_MS = 5 * Clock.MINUTE_MS;
  static readonly MAX_INTERVAL_MS = Clock.HOUR_MS;

  readonly #dependencies: LiveRefreshDependencies;
  readonly #stops: (() => void)[] = [];
  #failedRefreshes = 0;
  #inFlight: Promise<void> | undefined;
  #stopped = false;
  #timer: number | undefined;

  constructor(dependencies: LiveRefreshDependencies) {
    this.#dependencies = dependencies;
  }

  static attach(window: Window): LiveRefresh {
    const refresh = new LiveRefresh({
      random: Math.random,
      store: pageStore(),
      window,
      worker: new WorkerClient(
        bakedWorkerOrigin(),
        window.fetch.bind(window),
        SYSTEM_TIMING,
      ),
      reportError: (error) => {
        window.reportError(error);
      },
      visitorClock: () =>
        new Clock(
          new Date(),
          new Intl.DateTimeFormat().resolvedOptions().timeZone,
        ),
    });
    refresh.start();
    return refresh;
  }

  start(): void {
    const { store, visitorClock, window } = this.#dependencies;
    const unsubscribe = store.subscribe(() => {
      patchLiveTexts(window.document, store.read());
    });
    store.publish({ ...store.read(), clock: visitorClock() });
    const refreshIfVisible = () => {
      this.#refreshIfVisible();
    };
    window.document.addEventListener("visibilitychange", refreshIfVisible);
    this.#stops.push(
      unsubscribe,
      () => {
        window.document.removeEventListener(
          "visibilitychange",
          refreshIfVisible,
        );
      },
      () => {
        window.clearTimeout(this.#timer);
      },
    );
    this.#refreshReportingErrors();
  }

  stop(): void {
    this.#stopped = true;
    for (const stop of this.#stops.splice(0)) {
      stop();
    }
  }

  refresh(): Promise<void> {
    this.#inFlight ??= this.#refreshOnce().finally(() => {
      this.#inFlight = undefined;
    });
    return this.#inFlight;
  }

  #refreshIfVisible(): void {
    if (this.#dependencies.window.document.visibilityState === "visible") {
      this.#refreshReportingErrors();
    }
  }

  #refreshReportingErrors(): void {
    this.refresh().catch(this.#dependencies.reportError);
  }

  async #refreshOnce(): Promise<void> {
    const { store, visitorClock, worker } = this.#dependencies;
    const { failures, snapshot } = await worker.updateSnapshot(
      store.read().snapshot,
    );
    for (const failure of failures) {
      console.warn(
        `Live GitHub data is unavailable, so the page shows older data: ${failure.message}`,
      );
    }
    this.#failedRefreshes =
      failures.length === 0 ? 0 : this.#failedRefreshes + 1;
    store.publish({
      clock: visitorClock(),
      freshness: failures.length === 0 ? "live" : "stale",
      snapshot,
    });
    this.#scheduleNext(
      failures.flatMap((failure) =>
        failure instanceof WorkerFetchError ? (failure.retryAt ?? []) : [],
      ),
    );
  }

  #scheduleNext(retryAts: readonly Date[]): void {
    if (this.#stopped) {
      return;
    }
    const { window } = this.#dependencies;
    window.clearTimeout(this.#timer);
    this.#timer = window.setTimeout(() => {
      if (window.document.visibilityState === "visible") {
        this.#refreshReportingErrors();
      } else {
        this.#scheduleNext(retryAts);
      }
    }, this.#nextWaitMs(retryAts));
  }

  #nextWaitMs(retryAts: readonly Date[]): number {
    if (this.#failedRefreshes === 0) {
      return LiveRefresh.INTERVAL_MS;
    }
    // Equal jitter waits at least half the ceiling, which doubles from twice
    // the interval, so a failing worker is never asked again sooner than it
    // was before.
    const backoffMs = exponentialBackoffMs(
      LiveRefresh.INTERVAL_MS,
      this.#failedRefreshes + 1,
      this.#dependencies.random,
      LiveRefresh.MAX_INTERVAL_MS,
    );
    const now = this.#dependencies.visitorClock().now.getTime();
    return Math.max(
      backoffMs,
      ...retryAts.map((retryAt) => retryAt.getTime() - now),
    );
  }
}
