/**
 * @file The reply cache: the worker's store of each route's latest cached
 * reply, in a route store keyed by the route's path alone, so no query string
 * can bypass it. The reply's JSON text is the stored response's body, and its
 * access headers, the instant its data was fetched and the worker version that
 * stored it are the response's headers.
 *
 * A cached reply is kept for days, so the worker can serve it while GitHub
 * fails. One that this worker version stored is in the shape this version
 * encodes, so it is read back with no parsing; one another version stored is
 * checked against the contract first, and counts as none if it breaks it, as
 * one stored before a deploy changed the contract does.
 */

import type { WorkerRoute } from "@nusnus/github-data/routes";

import { ACCESS_HEADERS } from "@nusnus/github-data/access-headers";
import {
  WORKER_VERSION_HEADER,
  WorkerReplyError,
} from "@nusnus/github-data/routes";

import { RouteStore } from "../route-store.ts";
import { CachedReply } from "./cached-reply.ts";

/** Keeps each route's latest cached reply in the data center's cache. */
export class ReplyCache {
  static readonly #FETCHED_AT_HEADER = "Fetched-At";

  readonly #store: RouteStore;
  readonly #workerVersion: string;

  constructor(cache: Cache, workerOrigin: string, workerVersion: string) {
    this.#store = new RouteStore(cache, workerOrigin, {
      keyPrefix: "",
      name: "cached reply",
      // Long enough to ride out a GitHub outage or an expired token over a
      // weekend while the site shows the reply's age, and short enough that a
      // lasting failure surfaces as an error.
      retentionDays: 7,
      isOldShape: (error) => error instanceof WorkerReplyError,
    });
    this.#workerVersion = workerVersion;
  }

  async match(route: WorkerRoute<unknown>): Promise<CachedReply | undefined> {
    return this.#store.match(route, async (stored) => {
      const body = await stored.text();
      const fetchedAt = stored.headers.get(ReplyCache.#FETCHED_AT_HEADER);
      const tokenExpiry = stored.headers.get(ACCESS_HEADERS.tokenExpiry);
      if (
        stored.headers.get(WORKER_VERSION_HEADER) === this.#workerVersion &&
        fetchedAt !== null
      ) {
        return new CachedReply(body, new Date(fetchedAt), tokenExpiry);
      }
      const reply = route.parseReply(JSON.parse(body));
      return new CachedReply(body, reply.fetchedAt, tokenExpiry);
    });
  }

  async put(route: WorkerRoute<unknown>, cached: CachedReply): Promise<void> {
    await this.#store.put(route, cached.body, {
      ...cached.accessHeaders(),
      [ReplyCache.#FETCHED_AT_HEADER]: cached.fetchedAt.toISOString(),
      [WORKER_VERSION_HEADER]: this.#workerVersion,
    });
  }

  keyOf(route: WorkerRoute<unknown>): string {
    return this.#store.keyOf(route);
  }
}
