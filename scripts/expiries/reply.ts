/**
 * @file A service's response as the check receives it, read whole, and its
 * reading into a reply: a reply comes only with status 200, and its body must
 * be JSON that holds the reply's schema. Each failure says what to do next,
 * which for a failure that may pass is to let the next scheduled run repeat
 * the check.
 */

import * as schema from "@nusnus/github-data/schema";

import { ExpiryCheckError } from "./expiry.ts";

// The check runs on a schedule, as check-expiries.yml's `on:` block says, so
// a failure that passes needs nothing more.
export const NEXT_RUN = "The next scheduled run repeats the check";

const NEXT_RUN_OR_FIX = `${NEXT_RUN}; if the failure lasts, fix the expiry check's request to it.`;

/**
 * A service's response to the check's GET of `url`: its status, its headers,
 * and its body, read as text.
 */
export interface ReceivedResponse {
  readonly body: string;
  readonly headers: Headers;
  readonly status: number;
  readonly url: string;
}

export function parseReply<Reply>(
  response: ReceivedResponse,
  replySchema: schema.Schema<Reply>,
): Reply {
  if (response.status !== 200) {
    throw new ExpiryCheckError(
      `GET ${response.url} answered ${String(response.status)}: ${response.body}\n${NEXT_RUN_OR_FIX}`,
    );
  }
  return parseBody(response, replySchema);
}

export function parseBody<Body>(
  response: ReceivedResponse,
  bodySchema: schema.Schema<Body>,
): Body {
  return schema.parse(
    bodySchema,
    parseJson(response),
    (issues) =>
      new ExpiryCheckError(
        `The body GET ${response.url} answered with ${String(response.status)} is not in the shape the check reads:\n` +
          `${issues}\n${response.body}\n` +
          "Update the expiry check's schema for it to what the service sends now.",
      ),
  );
}

function parseJson({ body, status, url }: ReceivedResponse): unknown {
  try {
    return JSON.parse(body);
  } catch {
    // JSON.parse throws only a SyntaxError.
    throw new ExpiryCheckError(
      `The body GET ${url} answered with ${String(status)} is not JSON:\n${body}\n${NEXT_RUN_OR_FIX}`,
    );
  }
}
