/**
 * @file The worker's entry point: Cloudflare calls its fetch handler for each
 * request. It answers a GET of a worker route with that route's reply, any
 * other path with 404, any other method with 405, and a fault in the worker
 * with 500, which it logs, each response naming the worker's version; and it
 * gives the route server and its GitHub clients one clock and one random
 * source, and the reply cache the worker's version.
 */

import { WORKER_VERSION_HEADER } from "@nusnus/github-data/routes";

import { Backoffs } from "./cache/backoffs/backoffs.ts";
import { ReplyCache } from "./cache/cached-replies/reply-cache.ts";
import { RefreshLeases } from "./cache/refresh-leases.ts";
import { GitHubClient, runtimeFetch } from "./github/client.ts";
import { RequestPolicy } from "./github/request-policy.ts";
import { errorResponse, faultResponse } from "./serving/responses.ts";
import { findRouteSource, ROUTE_PATHS } from "./serving/router.ts";
import { RouteServer } from "./serving/server.ts";

// This isolate's refresh leases, which last as long as a refresh can.
const refreshLeases = new RefreshLeases(RouteServer.BACKGROUND_LIMIT_MS);

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const response = await respond(request, env, ctx).catch(
      (fault: unknown) => {
        console.error(
          `The worker failed to answer ${request.method} ${request.url}:`,
          fault,
        );
        return faultResponse(fault);
      },
    );
    response.headers.set(WORKER_VERSION_HEADER, env.CF_VERSION_METADATA.id);
    return response;
  },
} satisfies ExportedHandler<Env>;

async function respond(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const url = new URL(request.url);
  if (request.method !== "GET") {
    return errorResponse(
      405,
      `The worker serves GitHub data read-only, by GET; got ${request.method}.`,
      { Allow: "GET" },
    );
  }
  const source = findRouteSource(url.pathname);
  if (source === undefined) {
    return errorResponse(
      404,
      `The worker has no route at ${url.pathname}; it serves ${ROUTE_PATHS.join(", ")}.`,
    );
  }
  const now = (): Date => new Date();
  const server = new RouteServer({
    backoffs: new Backoffs(caches.default, url.origin),
    cache: new ReplyCache(
      caches.default,
      url.origin,
      env.CF_VERSION_METADATA.id,
    ),
    leases: refreshLeases,
    now,
    random: Math.random,
    createGitHubClient: (deadlineMs) =>
      new GitHubClient({
        deadlineMs,
        now,
        policy: RequestPolicy.DEFAULT,
        random: Math.random,
        token: env.GITHUB_TOKEN,
        wait: scheduler.wait.bind(scheduler),
        fetch: runtimeFetch,
      }),
    waitUntil: (promise) => {
      ctx.waitUntil(promise);
    },
  });
  return server.serve(source, request);
}
