/**
 * @file The page's live data store, built from the GitHub data the build baked
 * in the first time anything on the page reads it, as read by a UTC clock
 * stopped at the moment it was baked, so the server and the hydrating browser
 * render the same; and the worker origin the browser refreshes it from. A
 * subscriber's throw reaches the page's error reporting.
 */

import bakedModule from "virtual:baked-github-data";

import {
  type BakedGitHubData,
  parseBakedGitHubData,
} from "../snapshot/baked-github-data.ts";
import { Clock } from "../time/clock.ts";
import { LiveDataStore } from "./live-data-store.ts";

let baked: BakedGitHubData | undefined;
let store: LiveDataStore | undefined;

export function pageStore(): LiveDataStore {
  store ??= new LiveDataStore(
    {
      clock: new Clock(bakedGitHubData().bakedAt, "UTC"),
      freshness: "baked",
      snapshot: bakedGitHubData().snapshot,
    },
    (error) => {
      reportError(error);
    },
  );
  return store;
}

export function bakedWorkerOrigin(): URL {
  return bakedGitHubData().workerOrigin;
}

function bakedGitHubData(): BakedGitHubData {
  baked ??= parseBakedGitHubData(bakedModule);
  return baked;
}
