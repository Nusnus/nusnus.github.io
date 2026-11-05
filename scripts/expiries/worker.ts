/**
 * @file The worker's access to GitHub, as the check reads it from the worker's
 * reply to its profile route: the API version the worker requests, and when
 * its token expires. The reply must hold the contract, so it comes from the
 * worker that main deploys, which relays every token expiry GitHub sends.
 */

import { ACCESS_HEADERS } from "@nusnus/github-data/access-headers";
import { WORKER_ROUTES, WorkerReplyError } from "@nusnus/github-data/routes";
import * as schema from "@nusnus/github-data/schema";

import { ExpiryCheckError } from "./expiry.ts";
import { parseTokenExpiry } from "./github.ts";
import { NEXT_RUN, parseBody, type ReceivedResponse } from "./reply.ts";

const WORKER_LOGS =
  "the worker's logs, in the Cloudflare dashboard's Workers & Pages, say why";

/**
 * The worker's access to GitHub: the API version it requests, and when the
 * token that fetched its reply expires, or that it never does.
 */
export interface WorkerAccess {
  readonly apiVersion: string;
  readonly tokenExpiresAt: "never" | Date;
}

export function parseWorkerAccess(response: ReceivedResponse): WorkerAccess {
  if (response.status !== 200) {
    throw new ExpiryCheckError(
      `The worker answered GET ${response.url} with ${String(response.status)}: ${response.body}\n` +
        (response.status === 502
          ? `It could not fetch GitHub's data and had no cached reply to serve. ${NEXT_RUN}; if the failure lasts, ${WORKER_LOGS}.`
          : `Deploy the worker from main; if that does not fix it, ${WORKER_LOGS}.`),
    );
  }
  // Any JSON, which the contract then reads.
  const json = parseBody(response, schema.unknown());
  try {
    WORKER_ROUTES.profile.parseReply(json);
  } catch (error) {
    // The route fails only with a WorkerReplyError, so no input reaches the
    // rethrow, which keeps a bug from passing as a broken contract.
    // Stryker disable next-line ConditionalExpression,BlockStatement
    /* istanbul ignore if -- @preserve */
    if (!(error instanceof WorkerReplyError)) {
      throw error;
    }
    throw new ExpiryCheckError(error.message);
  }
  const tokenExpiry = response.headers.get(ACCESS_HEADERS.tokenExpiry);
  return {
    apiVersion: schema.parse(
      schema.iso.date(),
      response.headers.get(ACCESS_HEADERS.apiVersion),
      (issues) =>
        new ExpiryCheckError(
          `The worker's reply to GET ${response.url} has no valid API version in its ${ACCESS_HEADERS.apiVersion} header:\n` +
            `${issues}\nDeploy the worker from main.`,
        ),
    ),
    // GitHub sends a token's expiry only for a token that expires.
    tokenExpiresAt:
      tokenExpiry === null ? "never" : parseTokenExpiry(tokenExpiry),
  };
}
