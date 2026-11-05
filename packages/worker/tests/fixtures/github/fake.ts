/**
 * @file The fake GitHub: answers the worker's requests to GitHub's API with
 * exchanges recorded from GitHub's real API, so the worker's tests run its own
 * code against GitHub's real replies offline. A test replays exchanges, each
 * answering its request as often as it comes, and reads back every request the
 * fake received, in order; it can serve an exchange's reply for another
 * request, a scenario no exchange holds, such as another account's events
 * served as Tomer's; and for what no exchange can hold, it fails the next
 * requests that match one with an outage, before any exchange answers them. A
 * request no exchange answers fails as GitHub out of reach would, rather than
 * reaching the real GitHub. A test client is a GitHub client that talks to the
 * fake on a test clock, whose waits pass in no time and move the clock on.
 * Tests also read a real event of each type the contract holds, as GitHub's
 * Events API lists it.
 *
 * Each file under `rest/` and `graphql/` beside this module is one exchange,
 * in the contract's exchange form, recorded from GitHub by `bun run record`
 * (`scripts/record-exchanges.ts`); its response's `date` header says when, and
 * a REST response's `x-github-api-version-selected` under which API version.
 * A REST exchange is named for its request, `rest/users/Nusnus` for
 * `GET /users/Nusnus`, and a suffix names a page of a repository's
 * contributors, `.page-1`, or a reply other than the usual one:
 * `.unauthorized` for a refused token, `.rate-limited` for an unauthenticated
 * caller past GitHub's hourly limit, and `.invalid` for a request GitHub
 * refuses as invalid. `rest/zen` is a reply in plain text, and
 * `meilix/meilix-docs` an empty repository, whose contributors GitHub answers
 * with no content. A GraphQL exchange is named for what its query asks.
 *
 * Only public data was recorded: public events, public repositories and the
 * contribution graph. `events-of-every-type.json` holds one real event of each
 * type the contract holds: from the celery organization's events, as the
 * Events API listed them, where it had one, and from GH Archive
 * (https://www.gharchive.org), which records the public Events API, for the
 * rarer types.
 */

import type { EventType } from "@nusnus/github-data/activity";

import { setupNetwork } from "@msw/cloudflare";
import { ACCESS_HEADERS } from "@nusnus/github-data/access-headers";
import {
  bodyTextOf,
  type Exchange,
  type ExchangeRequest,
  type ExchangeResponse,
  type ReceivedRequest,
  receivedRequest,
} from "@nusnus/github-data/fixtures/exchange";
import { GITHUB_API_ORIGIN } from "@nusnus/github-data/github-links";
import { WORKER_FETCH_DEADLINE_MS } from "@nusnus/github-data/routes";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll } from "vitest";

import { GitHubClient, runtimeFetch } from "../../../src/github/client.ts";
import { RequestPolicy } from "../../../src/github/request-policy.ts";
import eventsOfEveryType from "./events-of-every-type.json" with { type: "json" };

/**
 * A real event of a type the contract holds, as GitHub's Events API lists it.
 */
export type RecordedEvent = (typeof eventsOfEveryType)[number];

/**
 * How the fake GitHub fails a request instead of answering it from an
 * exchange: with a reply no exchange can hold, by never answering, or by being
 * out of reach.
 */
export type Outage = "silence" | "unreachable" | ExchangeResponse;

/**
 * A GitHub client that talks to the fake GitHub, the waits it asked for, and
 * a way to move its clock on.
 */
export interface TestClient {
  readonly github: GitHubClient;
  readonly waits: readonly number[];
  readonly advance: (ms: number) => void;
}

/** What a test client is made with, where the defaults do not fit. */
export interface TestClientOptions {
  readonly deadlineMs?: number;
  readonly policy?: RequestPolicy;
  readonly startAt?: Date;
  readonly random?: () => number;
}

declare global {
  interface ImportMeta {
    // Vite's import of every file matching a glob, which Vitest runs; declared
    // here since the worker's packages cannot resolve Vite's own types:
    // https://vite.dev/guide/features#glob-import
    glob<Module>(
      pattern: string,
      options: { eager: true; import: "default" },
    ): Readonly<Record<string, Module>>;
  }
}

/** An outage of the fake GitHub, and how many more requests it fails. */
interface PlannedOutage {
  readonly outage: Outage;
  remaining: number;
  readonly request: ExchangeRequest;
}

// A glob keeps TypeScript from inferring a type for each exchange's file,
// which slows type checking to minutes. Vite reads a glob's arguments as
// written, before the module runs, and Stryker writes every mutant into the
// file at once, behind a switch, so a mutant there stops the module loading.
// Stryker disable StringLiteral,ObjectLiteral,BooleanLiteral
const EXCHANGES = import.meta.glob<Exchange>("./{rest,graphql}/**/*.json", {
  eager: true,
  import: "default",
});
// Stryker restore StringLiteral,ObjectLiteral,BooleanLiteral

// A test client's clock starts when GitHub sent its rate limit's reply.
const TEST_CLIENT_START = new Date("2026-11-04T07:20:05Z");

let replayed: Exchange[];
let outages: PlannedOutage[];
let received: ReceivedRequest[];
resetFakeGitHub();

const network = setupNetwork();
// A request that reaches no handler fails the test, rather than the network.
// It guards against a test that sends one, so no test sends one to tell it
// apart.
// Stryker disable next-line CallExpression,ObjectLiteral,StringLiteral
network.configure({ onUnhandledFrame: "error" });

const FAKE_GITHUB = http.all(`${GITHUB_API_ORIGIN}/*`, async ({ request }) => {
  const incoming = receivedRequest(request, await request.text());
  received.push(incoming);
  const planned = outages.find(
    ({ remaining, request: failed }) =>
      remaining > 0 && isSameRequest(failed, incoming),
  );
  if (planned !== undefined) {
    planned.remaining -= 1;
    return answerWith(planned.outage);
  }
  const exchange = replayed.find(({ request: recorded }) =>
    isSameRequest(recorded, incoming),
  );
  return exchange === undefined
    ? HttpResponse.error()
    : new Response(bodyTextOf(exchange), exchange);
});

export function useFakeGitHub(): void {
  beforeAll(() => {
    network.enable();
    network.use(FAKE_GITHUB);
  });
  afterEach(resetFakeGitHub);
  // Vitest runs each test file in an isolate of its own, so no test can see
  // the network still faked after its file's tests. A restore comment as a
  // block's last line attaches to nothing, so each line is disabled alone.
  // Stryker disable next-line BlockStatement,CallExpression
  afterAll(() => {
    // Stryker disable next-line CallExpression
    network.disable();
  });
}

export function recorded(name: string): Exchange {
  const exchange = EXCHANGES[`./${name}.json`];
  if (exchange === undefined) {
    throw new Error(
      `No exchange is recorded as ${name}; check the name against the exchanges beside the fake GitHub's module.`,
    );
  }
  return exchange;
}

export const EVENTS_OF_EVERY_TYPE: readonly RecordedEvent[] = eventsOfEveryType;

export function recordedEvent(type: EventType): RecordedEvent {
  const event = eventsOfEveryType.find((candidate) => candidate.type === type);
  if (event === undefined) {
    throw new Error(
      `No ${type} is recorded in events-of-every-type.json; add a real one, as the fake GitHub's docstring says.`,
    );
  }
  return event;
}

export function servedFor(
  exchange: Exchange,
  request: ExchangeRequest,
): Exchange {
  return { ...exchange, request };
}

// No exchange carries a token's expiry, since the token that recorded them
// never expires. This value is one GitHub sent for a fine-grained token, as
// reported in https://github.com/google/go-github/issues/2649
export function withExpiringToken(exchange: Exchange): Exchange {
  return {
    ...exchange,
    headers: {
      ...exchange.headers,
      [ACCESS_HEADERS.tokenExpiry]: "2023-04-26 23:23:18 +0200",
    },
  };
}

export function replayGitHub(...exchanges: readonly Exchange[]): void {
  replayed.push(...exchanges);
}

export function receivedRequests(): readonly ReceivedRequest[] {
  return received;
}

export function failGitHub(
  request: ExchangeRequest,
  outage: Outage,
  times = Number.POSITIVE_INFINITY,
): void {
  outages.push({ outage, remaining: times, request });
}

export function testClient({
  deadlineMs = WORKER_FETCH_DEADLINE_MS,
  policy = RequestPolicy.DEFAULT,
  random = () => 0.5,
  startAt = TEST_CLIENT_START,
}: TestClientOptions = {}): TestClient {
  let now = startAt;
  const waits: number[] = [];
  const advance = (ms: number): void => {
    now = new Date(now.getTime() + ms);
  };
  return {
    advance,
    github: new GitHubClient({
      deadlineMs,
      policy,
      random,
      token: "test-token",
      fetch: runtimeFetch,
      now: () => now,
      wait: (ms) => {
        waits.push(ms);
        advance(ms);
        return Promise.resolve();
      },
    }),
    waits,
  };
}

function resetFakeGitHub(): void {
  replayed = [];
  // An entry that is no planned outage fails no request, so no test can tell
  // a list holding one from an empty list.
  // Stryker disable next-line ArrayDeclaration
  outages = [];
  received = [];
}

function isSameRequest(
  expected: ExchangeRequest,
  actual: ExchangeRequest,
): boolean {
  return (
    expected.method === actual.method &&
    expected.url === actual.url &&
    JSON.stringify(expected.body) === JSON.stringify(actual.body)
  );
}

function answerWith(outage: Outage): Promise<never> | Response {
  if (outage === "silence") {
    // Never settles, so only the client's timeout ends the attempt.
    return new Promise<never>(() => undefined);
  }
  return outage === "unreachable"
    ? HttpResponse.error()
    : new Response(bodyTextOf(outage), outage);
}
