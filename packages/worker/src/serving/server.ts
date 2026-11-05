/**
 * @file The route server: serves a route's reply stale-while-revalidate, as a
 * cached reply with the expiry GitHub reported for the token that fetched it,
 * and asks GitHub no sooner than the route's backoff allows.
 *
 * A cached reply is served at once; once it is older than the route's fresh
 * window, the request also starts a background refresh, unless another request
 * already holds the lease to. With no cached reply, the request waits for
 * GitHub, up to the contract's fetch deadline, and a failure there is a 502
 * that says when the worker asks GitHub again. Each failed fetch sets the
 * route's backoff, whether GitHub failed or the worker did, so a fetch that
 * fails every time asks GitHub no more often; each successful one clears it.
 * Until the backoff's instant, a stale reply stays as it is, its `fetchedAt`
 * showing its age, and a route with no cached reply answers 502 without
 * asking GitHub.
 */

import { WORKER_FETCH_DEADLINE_MS } from "@nusnus/github-data/routes";

import type { Backoffs } from "../cache/backoffs/backoffs.ts";
import type { ReplyCache } from "../cache/cached-replies/reply-cache.ts";
import type { RefreshLeases } from "../cache/refresh-leases.ts";
import type { GitHubClient } from "../github/client.ts";
import type { RouteSource } from "../routes/route-source.ts";

import { Backoff } from "../cache/backoffs/backoff.ts";
import { CachedReply } from "../cache/cached-replies/cached-reply.ts";
import { GitHubError } from "../github/failures.ts";
import {
  cachedReplyResponse,
  fetchedReplyResponse,
  unavailableResponse,
} from "./responses.ts";

/**
 * What the route server needs from the request it serves and from its isolate:
 * where it keeps cached replies, backoffs and refresh leases, how it makes a
 * GitHub client whose requests all end within a deadline, its clock and random
 * source, and how it keeps the request's invocation alive for work that goes
 * on after the response.
 */
export interface RouteServerDependencies {
  readonly backoffs: Backoffs;
  readonly cache: ReplyCache;
  readonly leases: RefreshLeases;
  readonly createGitHubClient: (deadlineMs: number) => GitHubClient;
  readonly now: () => Date;
  readonly random: () => number;
  readonly waitUntil: (promise: Promise<unknown>) => void;
}

/**
 * Serves each route's reply from the cache, stale while it revalidates, or
 * from GitHub when no cached reply exists, asking GitHub no sooner than the
 * route's backoff allows.
 */
export class RouteServer {
  // How long work may go on after the response is sent; the runtime cancels
  // what is left: https://developers.cloudflare.com/workers/runtime-apis/context/#waituntil
  static readonly BACKGROUND_LIMIT_MS = 30_000;

  readonly #dependencies: RouteServerDependencies;

  constructor(dependencies: RouteServerDependencies) {
    this.#dependencies = dependencies;
  }

  async serve<Data>(
    source: RouteSource<Data>,
    request: Request,
  ): Promise<Response> {
    const { backoffs, cache, leases, now, waitUntil } = this.#dependencies;
    const cached = await cache.match(source.route);
    if (cached !== undefined) {
      const servedAt = now();
      const ttlSeconds =
        source.freshForSeconds -
        (servedAt.getTime() - cached.fetchedAt.getTime()) / 1000;
      if (
        ttlSeconds <= 0 &&
        leases.tryAcquire(cache.keyOf(source.route), servedAt)
      ) {
        waitUntil(this.#refreshInBackground(source));
      }
      return cachedReplyResponse(request, cached, ttlSeconds);
    }
    const backoff = await backoffs.match(source.route);
    const askedAt = now();
    if (backoff?.defers(askedAt) === true) {
      return unavailableResponse(source.route, backoff, askedAt);
    }
    const outcome = await this.#fetch(source, backoff);
    waitUntil(this.#store(source, outcome));
    return outcome instanceof Backoff
      ? unavailableResponse(source.route, outcome, now())
      : fetchedReplyResponse(request, outcome);
  }

  async #refreshInBackground<Data>(source: RouteSource<Data>): Promise<void> {
    const backoff = await this.#dependencies.backoffs.match(source.route);
    if (backoff?.defers(this.#dependencies.now()) !== true) {
      await this.#store(source, await this.#fetch(source, backoff));
    }
  }

  async #fetch<Data>(
    source: RouteSource<Data>,
    backoff: Backoff | undefined,
  ): Promise<Backoff | CachedReply> {
    const { createGitHubClient, now, random } = this.#dependencies;
    const github = createGitHubClient(WORKER_FETCH_DEADLINE_MS);
    try {
      const data = await source.fetchData(github);
      return CachedReply.encode(
        source.route,
        { data, fetchedAt: now() },
        github.tokenExpiry,
      );
    } catch (error) {
      // A fault in the worker, such as data the contract refuses, sets the
      // backoff as GitHub's failures do, so a fetch that fails each time asks
      // GitHub no more often than a failing GitHub is asked.
      const next = Backoff.after(
        backoff,
        error instanceof GitHubError ? error : { message: String(error) },
        now(),
        random,
      );
      console.error(
        `Fetching ${source.route.path}'s data failed; the worker asks GitHub again at ${next.notBefore.toISOString()}:`,
        error,
      );
      return next;
    }
  }

  async #store<Data>(
    source: RouteSource<Data>,
    outcome: Backoff | CachedReply,
  ): Promise<void> {
    const { backoffs, cache } = this.#dependencies;
    if (outcome instanceof Backoff) {
      await backoffs.put(source.route, outcome);
    } else {
      await Promise.all([
        cache.put(source.route, outcome),
        backoffs.delete(source.route),
      ]);
    }
  }
}
