/**
 * @file A cached reply: a worker reply encoded once, when the worker fetches
 * its data, as the JSON text every response then sends as it is, with what
 * travels beside it: the instant its data was fetched, which says how fresh
 * the reply is and tags each copy of it, and the expiry of the token that
 * fetched it, whether the worker fetched it just now or read it from its
 * cache. Its access headers carry that expiry and the API version the worker
 * requests.
 */

import type { WorkerReply, WorkerRoute } from "@nusnus/github-data/routes";

import { ACCESS_HEADERS } from "@nusnus/github-data/access-headers";

import { GITHUB_API_VERSION } from "../../github/api-version.ts";

/**
 * A route's reply as the JSON text the worker sends, the instant its data was
 * fetched, and the expiry of the token that fetched it, verbatim as GitHub
 * reported it, or `null` when GitHub reported none, as for a token that never
 * expires.
 */
export class CachedReply {
  readonly body: string;
  readonly fetchedAt: Date;
  readonly tokenExpiry: null | string;

  constructor(body: string, fetchedAt: Date, tokenExpiry: null | string) {
    this.body = body;
    this.fetchedAt = fetchedAt;
    this.tokenExpiry = tokenExpiry;
  }

  // Encoding the reply checks it against the route's contract.
  static encode<Data>(
    route: WorkerRoute<Data>,
    reply: WorkerReply<Data>,
    tokenExpiry: null | string,
  ): CachedReply {
    return new CachedReply(
      JSON.stringify(route.encodeReply(reply)),
      reply.fetchedAt,
      tokenExpiry,
    );
  }

  accessHeaders(): Readonly<Record<string, string>> {
    return {
      [ACCESS_HEADERS.apiVersion]: GITHUB_API_VERSION,
      ...(this.tokenExpiry === null
        ? {}
        : { [ACCESS_HEADERS.tokenExpiry]: this.tokenExpiry }),
    };
  }
}
