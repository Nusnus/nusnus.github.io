/**
 * @file Live data: the GitHub data the page shows, the clock it reads times by,
 * and how fresh the data is; and the store that holds it, which the live
 * refresh publishes to and every live island and live text follows.
 */

import type { GitHubSnapshot } from "../snapshot/snapshot.ts";
import type { Clock } from "../time/clock.ts";

/**
 * How the page's data relates to the worker: `baked` until the first refresh
 * answers, `live` while the last refresh got every route's reply, and `stale`
 * while it got only some, or none, and the page shows older replies for the
 * rest.
 */
export type Freshness = "baked" | "live" | "stale";

/** The page's GitHub data, the clock it reads times by, and its freshness. */
export interface LiveData {
  readonly clock: Clock;
  readonly freshness: Freshness;
  readonly snapshot: GitHubSnapshot;
}

/**
 * Holds the page's live data, starting from the data baked into the page, and
 * tells each subscriber when it changes, reporting any subscriber that throws
 * without keeping the rest from hearing. Its methods suit React's
 * `useSyncExternalStore`, which reads the initial data while it hydrates an
 * island, so the island matches its server-rendered HTML.
 */
export class LiveDataStore {
  readonly #initial: LiveData;
  readonly #listeners = new Set<() => void>();
  readonly #reportError: (error: unknown) => void;
  #current: LiveData;

  constructor(initial: LiveData, reportError: (error: unknown) => void) {
    this.#initial = initial;
    this.#current = initial;
    this.#reportError = reportError;
  }

  readonly read = (): LiveData => this.#current;

  readonly readInitial = (): LiveData => this.#initial;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  publish(data: LiveData): void {
    this.#current = data;
    for (const listener of this.#listeners) {
      try {
        listener();
      } catch (error) {
        this.#reportError(error);
      }
    }
  }
}
