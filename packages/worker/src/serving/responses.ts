/**
 * @file The worker's HTTP responses: a route's reply, a "not modified" answer
 * to a browser whose copy is current, and errors, in the contract's shape:
 * among them a route's data being unavailable while GitHub fails, which says
 * when the worker asks GitHub again, in its text and in a Retry-After header,
 * and a fault in the worker.
 *
 * Every response is open to any origin, since the data is public and read-only.
 * A reply is sent as the JSON text its cached reply holds, and revalidated on
 * every page load, cheaply: its entity tag is the instant its data was fetched,
 * so a browser holding it gets a bodiless 304. Each reply says whether it came
 * from the worker's cache in a `Cache-Status` header (RFC 9211), whose `ttl` is
 * negative once the cached reply is stale, and carries the access headers.
 */

import type { WorkerError, WorkerRoute } from "@nusnus/github-data/routes";

import { retryAfterOf } from "@nusnus/github-data/retries";

import type { Backoff } from "../cache/backoffs/backoff.ts";
import type { CachedReply } from "../cache/cached-replies/cached-reply.ts";

const SHARED_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
} as const;

export function cachedReplyResponse(
  request: Request,
  cached: CachedReply,
  ttlSeconds: number,
): Response {
  return replyResponse(
    request,
    cached,
    `worker; hit; ttl=${String(Math.floor(ttlSeconds))}`,
  );
}

export function fetchedReplyResponse(
  request: Request,
  fetched: CachedReply,
): Response {
  return replyResponse(request, fetched, "worker; fwd=uri-miss; stored");
}

export function unavailableResponse(
  route: WorkerRoute<unknown>,
  backoff: Backoff,
  now: Date,
): Response {
  return errorResponse(
    502,
    `GitHub data for ${route.path} is unavailable, and the worker has no cached reply to serve: ${backoff.reason}\n` +
      `The worker asks GitHub again at ${backoff.notBefore.toISOString()}.`,
    {
      // A page's script reads only the headers a response exposes to it:
      // https://fetch.spec.whatwg.org/#http-access-control-expose-headers
      "Access-Control-Expose-Headers": "Retry-After",
      "Retry-After": retryAfterOf(backoff.notBefore, now),
    },
  );
}

export function faultResponse(fault: unknown): Response {
  return errorResponse(
    500,
    `The worker failed to answer: ${String(fault)}\n` +
      "Fix the fault in the worker; its logs say where it arose.",
  );
}

export function errorResponse(
  status: 404 | 405 | 500 | 502,
  message: string,
  headers: Readonly<Record<string, string>> = {},
): Response {
  return new Response(
    JSON.stringify({ error: message } satisfies WorkerError),
    {
      headers: { ...SHARED_HEADERS, "Cache-Control": "no-store", ...headers },
      status,
    },
  );
}

function replyResponse(
  request: Request,
  cached: CachedReply,
  cacheStatus: string,
): Response {
  const entityTag = `"${cached.fetchedAt.toISOString()}"`;
  const headers = {
    ...SHARED_HEADERS,
    "Cache-Control": "no-cache",
    "Cache-Status": cacheStatus,
    ETag: entityTag,
    ...cached.accessHeaders(),
  };
  return matchesEntityTag(request.headers.get("If-None-Match"), entityTag)
    ? new Response(null, { headers, status: 304 })
    : new Response(cached.body, { headers });
}

// RFC 9110 compares entity tags in If-None-Match weakly:
// https://www.rfc-editor.org/rfc/rfc9110#field.if-none-match
function matchesEntityTag(
  ifNoneMatch: null | string,
  entityTag: string,
): boolean {
  if (ifNoneMatch === null) {
    return false;
  }
  return ifNoneMatch
    .split(",")
    .map((tag) => tag.trim().replace(/^W\//, ""))
    .some((tag) => tag === "*" || tag === entityTag);
}
