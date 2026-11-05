/**
 * @file The fake network: replays exchanges recorded from the services the
 * scripts ask, so their tests run the scripts' own code against the services'
 * real replies offline, and fails a request as the network can: out of reach,
 * silent past its deadline, or broken part way through its body. A request no
 * replay answers fails as one out of reach does, and each a replay answers is
 * kept for `receivedRequests` to read.
 *
 * Each JSON file beside this module is one exchange, in the form the
 * contract's `exchange` module defines, recorded by the services' recorder,
 * `bun run record:services`, which says what each asks, and with which token;
 * its reply's `date` header says when. The worker's replies are the
 * contract's worker exchanges, which the worker's own tests write.
 */

import {
  bodyTextOf,
  type Exchange,
  type ReceivedRequest,
  receivedRequest,
} from "@nusnus/github-data/fixtures/exchange";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, vi } from "vitest";

import type { ReceivedResponse } from "../../../scripts/expiries/reply.ts";

// Every request no replay answers fails as an unreachable network fails it.
// MSW's own strategies for an unhandled request let some through to the real
// network: one for a common asset, such as a .json file, and one a handler
// matched but left unanswered, as a replay leaves a request it holds no
// exchange for: https://mswjs.io/api/setup-server/listen
const network = setupServer(http.all("*", () => HttpResponse.error()));

let received: ReceivedRequest[];

// Vitest runs each test file in a fresh process or isolate, so the network
// ends with its test file.
export function useFakeNetwork(): void {
  beforeAll(() => {
    network.listen();
  });
  beforeEach(() => {
    received = [];
  });
  // Only a Vitest run of its own, which the fake network's integration test
  // starts, shows the replays' reset, and mutation testing does not see into
  // that run. A restore comment as a block's last line attaches to nothing,
  // so each line is disabled alone.
  // Stryker disable next-line BlockStatement,CallExpression
  afterEach(() => {
    // Stryker disable next-line CallExpression
    network.resetHandlers();
  });
}

export function recorded(name: string): Exchange {
  // Read, not imported, since TypeScript would infer a type for each
  // exchange, which slows type checking.
  return JSON.parse(
    readFileSync(path.join(import.meta.dirname, `${name}.json`), "utf8"),
  ) as Exchange;
}

export function servedAt(exchange: Exchange, url: string): Exchange {
  return { ...exchange, request: { ...exchange.request, url } };
}

export function receivedFrom(exchange: Exchange): ReceivedResponse {
  return {
    body: bodyTextOf(exchange) ?? "",
    headers: new Headers(exchange.headers),
    status: exchange.status,
    url: exchange.request.url,
  };
}

export function replayServices(...exchanges: readonly Exchange[]): void {
  network.use(
    http.get("*", async ({ request }) => {
      const exchange = exchanges.find(
        ({ request: recordedRequest }) => recordedRequest.url === request.url,
      );
      if (exchange === undefined) {
        // Another replay, or none, answers it.
        return undefined;
      }
      received.push(receivedRequest(request, await request.text()));
      return new HttpResponse(bodyTextOf(exchange), exchange);
    }),
  );
}

export function receivedRequests(): readonly ReceivedRequest[] {
  return received;
}

export function unreachable(url: string): void {
  network.use(
    http.get("*", ({ request }) =>
      request.url === url ? HttpResponse.error() : undefined,
    ),
  );
}

export function silence(url: string): void {
  // The deadline's own error, which fetch rejects with once it passes:
  // https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static
  answerFetch(url, () =>
    Promise.reject(
      new DOMException(
        "The operation was aborted due to timeout",
        "TimeoutError",
      ),
    ),
  );
}

export function breakBody(url: string, error: Error): void {
  answerFetch(url, () =>
    Promise.resolve(
      new Response(
        new ReadableStream({
          pull(controller) {
            controller.error(error);
          },
        }),
      ),
    ),
  );
}

// MSW reads each body before it answers, and answers no request past its
// deadline at once, so these two failures come from fetch itself.
function answerFetch(url: string, answer: () => Promise<Response>): void {
  const fetchFromNetwork = globalThis.fetch;
  vi.spyOn(globalThis, "fetch").mockImplementation((input, init) =>
    new Request(input, init).url === url
      ? answer()
      : fetchFromNetwork(input, init),
  );
}
