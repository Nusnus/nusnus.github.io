/**
 * @file The worker replay's server: it answers each route with its
 * recorded reply, open to every origin, and any other path with the worker's
 * recorded 404, refuses a request with no URL, and takes a port from 1 to
 * 65535.
 */

import type { IncomingMessage, ServerResponse } from "node:http";

import { profileReply } from "@nusnus/github-data/fixtures/worker-replies";
import { describe, expect, it } from "vitest";

import {
  answerReplayRequest,
  parsePort,
} from "../../../../fixtures/worker/replay/server.ts";

function answer(url: string | undefined) {
  const sent: { body?: string; headers?: unknown; status?: number } = {};
  const response = {
    end: (body: string) => {
      sent.body = body;
    },
    writeHead: (status: number, headers: unknown) => {
      sent.status = status;
      sent.headers = headers;
    },
  };
  answerReplayRequest(
    { url } as IncomingMessage,
    response as unknown as ServerResponse,
  );
  return {
    body: JSON.parse(sent.body ?? "") as unknown,
    headers: sent.headers,
    status: sent.status,
  };
}

describe("answerReplayRequest", () => {
  it("answers a route with its recorded reply, open to every origin", () => {
    expect(answer("/profile?fresh=1")).toStrictEqual({
      body: profileReply,
      headers: {
        "access-control-allow-origin": "*",
        "content-type": "application/json",
      },
      status: 200,
    });
  });

  it("answers any other path with the worker's recorded 404", () => {
    expect(answer("/nothing")).toStrictEqual({
      body: {
        error:
          "The worker has no route at /no-such-route; it serves /activity, /contribution-graph, /profile, /repositories.",
      },
      headers: {
        "access-control-allow-origin": "*",
        "cache-control": "no-store",
        "content-type": "application/json",
        "worker-version": "0e1f4789-4064-4773-80b2-67a5e0d3f1c2",
      },
      status: 404,
    });
  });

  it("refuses a request with no URL, which no server gets", () => {
    expect(() => answer(undefined)).toThrow(
      new TypeError(
        "The worker replay got a request with no URL; give it requests from an HTTP server.",
      ),
    );
  });
});

describe("parsePort", () => {
  it.each([
    ["1", 1],
    ["5409", 5409],
    ["65535", 65_535],
  ])("takes %s as port %i", (argument, port) => {
    expect(parsePort(argument)).toBe(port);
  });

  it.each([
    [
      undefined,
      "The worker replay needs a port from 1 to 65535, got \"\"; start it with WORKER_REPLAY's port, as the smoke tests' Playwright config does.",
    ],
    [
      "0",
      "The worker replay needs a port from 1 to 65535, got \"0\"; start it with WORKER_REPLAY's port, as the smoke tests' Playwright config does.",
    ],
    [
      "65536",
      "The worker replay needs a port from 1 to 65535, got \"65536\"; start it with WORKER_REPLAY's port, as the smoke tests' Playwright config does.",
    ],
    [
      "54.5",
      "The worker replay needs a port from 1 to 65535, got \"54.5\"; start it with WORKER_REPLAY's port, as the smoke tests' Playwright config does.",
    ],
    [
      "1e3",
      "The worker replay needs a port from 1 to 65535, got \"1e3\"; start it with WORKER_REPLAY's port, as the smoke tests' Playwright config does.",
    ],
  ])("refuses %s", (argument, message) => {
    expect(() => parsePort(argument)).toThrow(new RangeError(message));
  });
});
