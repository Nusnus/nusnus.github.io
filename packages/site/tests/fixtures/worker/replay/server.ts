/**
 * @file The worker replay's server, which replays the contract's recorded
 * worker replies over HTTP, as the worker serves them, so the smoke tests'
 * build and browser need no network: what it answers each request with, each
 * route's reply at its path, open to every origin, and the worker's recorded
 * 404 for any other path; and the port it listens on, from its command line.
 */

import type { RequestListener } from "node:http";

import { bodyTextOf } from "@nusnus/github-data/fixtures/exchange";

import { HIGHEST_PORT, isPort } from "../../servers.ts";
import { recordedResponseAt } from "../recorded-responses.ts";

export const answerReplayRequest: RequestListener = (request, response) => {
  // Node gives every request to a server its URL, and only a client's
  // response has none: https://nodejs.org/api/http.html#messageurl
  if (request.url === undefined) {
    throw new TypeError(
      "The worker replay got a request with no URL; give it requests from an HTTP server.",
    );
  }
  const recorded = recordedResponseAt(
    new URL(request.url, "http://replay").pathname,
  );
  response.writeHead(recorded.status, recorded.headers);
  response.end(bodyTextOf(recorded));
};

export function parsePort(argument: string | undefined): number {
  const text = argument ?? "";
  if (!isPort(text, HIGHEST_PORT)) {
    throw new RangeError(
      `The worker replay needs a port from 1 to ${String(HIGHEST_PORT)}, got "${text}"; start it with WORKER_REPLAY's port, as the smoke tests' Playwright config does.`,
    );
  }
  return Number(text);
}
