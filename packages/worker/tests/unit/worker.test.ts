/**
 * @file The worker's entry point: a GET of a route served with the worker's
 * token, after the runtime's wait when GitHub fails for a moment, and cached
 * by path alone, whatever the query string; 500 for a fault in the worker,
 * 404 for any other path and 405 for any other method, each saying what went
 * wrong; and every response naming the worker's version. From GitHub's
 * recorded exchanges, it serves each route the reply the contract's fixtures
 * hold, as does the activity of other accounts it serves redacted; and the
 * contract's worker exchanges hold its whole replies to the clients that read
 * more than the data: the profile route's, with its access headers; its 502
 * while GitHub refuses it and it has no cached reply; and its 404.
 * `bun run update:worker-replies` rewrites both from what it serves.
 */

import {
  type Exchange,
  recordedResponse,
} from "@nusnus/github-data/fixtures/exchange";
import { TRACKED_REPOSITORIES } from "@nusnus/github-data/repositories";
import {
  WORKER_ORIGIN,
  WORKER_ROUTES,
  WORKER_VERSION_HEADER,
  type WorkerRouteName,
} from "@nusnus/github-data/routes";
import {
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";

import worker from "../../src/worker.ts";
import {
  failGitHub,
  receivedRequests,
  recorded,
  replayGitHub,
  servedFor,
  useFakeGitHub,
  withExpiringToken,
} from "../fixtures/github/fake.ts";
import { FAULT_STEP } from "../fixtures/next-steps.ts";

useFakeGitHub();

afterEach(() => {
  vi.useRealTimers();
});

// File snapshots take a file's path, so the tests reach the contract's
// fixtures by theirs rather than by the package's name.
const CONTRACT_FIXTURES = "../../../github-data/tests/fixtures";

// GitHub's exchanges behind each route's reply, and the contract's fixture of
// that reply.
const ROUTE_REPLIES: Readonly<
  Record<WorkerRouteName, { exchanges: readonly Exchange[]; fixture: string }>
> = {
  activity: {
    exchanges: [
      recorded("rest/users/Nusnus/events/public"),
      recorded("graphql/titles-of-user-events"),
    ],
    fixture: "activity-reply.json",
  },
  contributionGraph: {
    exchanges: [recorded("graphql/contributions")],
    fixture: "contribution-graph-reply.json",
  },
  profile: {
    exchanges: [recorded("rest/users/Nusnus")],
    fixture: "profile-reply.json",
  },
  repositories: {
    exchanges: TRACKED_REPOSITORIES.flatMap(({ fullName }) => [
      recorded(`rest/repos/${fullName}`),
      recorded(`rest/repos/${fullName}/contributors.page-1`),
    ]),
    fixture: "repositories-reply.json",
  },
};

type WorkerRequest = Request<unknown, IncomingRequestCfProperties>;

// Cloudflare gives the worker a new id each time a test starts it, so the
// tests run it as this version.
const VERSION_ID = "0e1f4789-4064-4773-80b2-67a5e0d3f1c2";
const VERSIONED_ENV: Env = {
  ...env,
  CF_VERSION_METADATA: { id: VERSION_ID, tag: "", timestamp: "" },
};

// Each request goes to a worker of its own, whose cache no other test shares.
function requestTo(path: string, method = "GET"): WorkerRequest {
  return new Request(`https://${crypto.randomUUID()}.worker.test${path}`, {
    method,
  });
}

async function fetchFromWorker(request: WorkerRequest): Promise<Response> {
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, VERSIONED_ENV, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

// The worker stamps a reply with the instant GitHub answered the last of its
// requests, as each response's date header records it.
function setClockToLastAnswer(...exchanges: readonly Exchange[]): void {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(
    Math.max(
      ...exchanges.map(({ headers }) => Date.parse(String(headers["date"]))),
    ),
  );
}

async function deployedWorkerExchange(path: string): Promise<string> {
  const response = await fetchFromWorker(requestTo(path));
  const exchange = {
    request: { method: "GET", url: `${WORKER_ORIGIN}${path}` },
    ...recordedResponse(response, await response.text()),
  };
  return `${JSON.stringify(exchange, null, 2)}\n`;
}

describe("worker.fetch", () => {
  it("serves a route's reply, fetched with the worker's token", async () => {
    replayGitHub(recorded("rest/users/Nusnus"));

    const response = await fetchFromWorker(requestTo("/profile"));

    expect([
      response.status,
      receivedRequests()[0]?.headers["authorization"],
    ]).toStrictEqual([200, "Bearer test-token"]);
  });

  it("retries a transient GitHub failure after the runtime's wait", async () => {
    const wait = vi.spyOn(scheduler, "wait").mockResolvedValue(undefined);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    replayGitHub(recorded("rest/users/Nusnus"));
    // A server error cannot be recorded on demand, so its reply is written
    // here.
    failGitHub(
      recorded("rest/users/Nusnus").request,
      { status: 503, headers: {} },
      1,
    );

    const response = await fetchFromWorker(requestTo("/profile"));

    expect([
      response.status,
      receivedRequests().length,
      wait.mock.calls,
    ]).toStrictEqual([200, 2, [[750]]]);
  });

  it("serves a route's cached reply whatever the query string", async () => {
    replayGitHub(recorded("rest/users/Nusnus"));
    const first = requestTo("/profile");
    await fetchFromWorker(first);

    const response = await fetchFromWorker(
      new Request(`${first.url}?bypass=1`),
    );

    expect([
      response.headers.get("Cache-Status")?.startsWith("worker; hit"),
      receivedRequests().length,
    ]).toStrictEqual([true, 1]);
  });

  it("answers a fault in the worker with 500, saying what failed, and logs it", async () => {
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    // A cached reply no worker writes, which only a fault could leave, at an
    // origin no other test asks.
    await caches.default.put(
      "https://fault.worker.test/profile",
      new Response("{", { headers: { "Cache-Control": "max-age=60" } }),
    );

    const response = await fetchFromWorker(
      new Request("https://fault.worker.test/profile"),
    );

    expect(error).toHaveBeenCalledExactlyOnceWith(
      "The worker failed to answer GET https://fault.worker.test/profile:",
      new SyntaxError(
        "Expected property name or '}' in JSON at position 1 (line 1 column 2)",
      ),
    );
    expect([
      response.status,
      response.headers.get("Access-Control-Allow-Origin"),
      response.headers.get(WORKER_VERSION_HEADER),
      await response.json(),
    ]).toStrictEqual([
      500,
      "*",
      VERSION_ID,
      {
        error:
          "The worker failed to answer: SyntaxError: Expected property name or '}' in JSON at position 1 (line 1 column 2)\n" +
          FAULT_STEP,
      },
    ]);
  });

  it("answers any other path with 404, listing the routes", async () => {
    const response = await fetchFromWorker(requestTo("/github/profile"));

    expect([response.status, await response.json()]).toStrictEqual([
      404,
      {
        error:
          "The worker has no route at /github/profile; it serves /activity, /contribution-graph, /profile, /repositories.",
      },
    ]);
  });

  it.each([
    ["POST", "The worker serves GitHub data read-only, by GET; got POST."],
    [
      "OPTIONS",
      "The worker serves GitHub data read-only, by GET; got OPTIONS.",
    ],
  ])("answers %s with 405, allowing only GET", async (method, error) => {
    const response = await fetchFromWorker(requestTo("/profile", method));

    expect([
      response.status,
      response.headers.get("Allow"),
      await response.json(),
    ]).toStrictEqual([405, "GET", { error }]);
  });

  it.each([
    ["GET", "/profile", 200],
    ["GET", "/github/profile", 404],
    ["POST", "/profile", 405],
  ])(
    "names its version on its response to %s %s",
    async (method, path, status) => {
      replayGitHub(recorded("rest/users/Nusnus"));

      const response = await fetchFromWorker(requestTo(path, method));

      expect([
        response.status,
        response.headers.get(WORKER_VERSION_HEADER),
      ]).toStrictEqual([status, VERSION_ID]);
    },
  );

  it.each(Object.entries(ROUTE_REPLIES))(
    "serves %s the reply the contract's fixtures hold, from GitHub's recorded exchanges",
    async (name, { exchanges, fixture }) => {
      setClockToLastAnswer(...exchanges);
      replayGitHub(...exchanges);
      const { path } = WORKER_ROUTES[name as WorkerRouteName];

      const response = await fetchFromWorker(requestTo(path));

      await expect(
        `${JSON.stringify(await response.json(), null, 2)}\n`,
      ).toMatchFileSnapshot(`${CONTRACT_FIXTURES}/${fixture}`);
    },
  );

  it("serves activity in repositories off the allowlist redacted, as the contract's redacted reply holds it", async () => {
    // GitHub's public events of every account, served as Tomer's.
    const othersEvents = servedFor(
      recorded("rest/events"),
      recorded("rest/users/Nusnus/events/public").request,
    );
    setClockToLastAnswer(othersEvents);
    replayGitHub(othersEvents);

    const response = await fetchFromWorker(requestTo("/activity"));

    await expect(
      `${JSON.stringify(await response.json(), null, 2)}\n`,
    ).toMatchFileSnapshot(`${CONTRACT_FIXTURES}/redacted-activity-reply.json`);
  });
});

describe("the worker's exchanges", () => {
  it("serves the profile route with its access headers, as the contract's worker exchange holds it", async () => {
    const user = withExpiringToken(recorded("rest/users/Nusnus"));
    setClockToLastAnswer(user);
    replayGitHub(user);

    await expect(await deployedWorkerExchange("/profile")).toMatchFileSnapshot(
      `${CONTRACT_FIXTURES}/profile-exchange.json`,
    );
  });

  it("answers 502 while GitHub refuses it and it has no cached reply, as the contract's worker exchange holds it", async () => {
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const rateLimited = recorded("rest/users/Nusnus.rate-limited");
    setClockToLastAnswer(rateLimited);
    replayGitHub(rateLimited);

    await expect(await deployedWorkerExchange("/profile")).toMatchFileSnapshot(
      `${CONTRACT_FIXTURES}/profile-unavailable-exchange.json`,
    );
    expect(error).toHaveBeenCalledExactlyOnceWith(
      "Fetching /profile's data failed; the worker asks GitHub again at 2026-11-04T08:20:04.000Z:",
      expect.objectContaining({
        kind: "rate limited",
        message:
          'GitHub answered GET /users/Nusnus with 403: {"message":"API rate limit exceeded for 203.0.113.7. (But here\'s the good news: Authenticated requests get a higher rate limit. Check out the documentation for more details.)","documentation_url":"https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting"}\n' +
          "GitHub allows requests again at 2026-11-04T08:20:04.000Z.",
        name: "GitHubError",
      }),
    );
  });

  it("answers a path it has no route at with 404, as the contract's worker exchange holds it", async () => {
    await expect(
      await deployedWorkerExchange("/no-such-route"),
    ).toMatchFileSnapshot(`${CONTRACT_FIXTURES}/no-such-route-exchange.json`);
  });
});
