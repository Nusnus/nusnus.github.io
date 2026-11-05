/**
 * @file The worker client: it fetches each route from the worker's origin
 * within a time limit and parses the reply with the contract; it retries a
 * network failure, a timeout or a server error Cloudflare sent for the worker,
 * after the wait the response asks for or a jittered backoff that doubles, up
 * to three attempts; it fails at once on an error the worker sent, in the
 * worker's words, and on anything else, each time with a message that names
 * the cause and with when the last response asked to be retried, if it did;
 * and it fetches whole snapshots, all or nothing for the build and route by
 * route for an update, which keeps a failed route's previous reply.
 */

import {
  activityReply,
  contributionGraphReply,
  profileReply,
  repositoriesReply,
} from "@nusnus/github-data/fixtures/worker-replies";
import { WORKER_ROUTES, WorkerReplyError } from "@nusnus/github-data/routes";
import { afterEach, describe, expect, it, vi } from "vitest";

import { encodeSnapshot } from "../../../../src/github-data/snapshot/snapshot.ts";
import {
  SYSTEM_TIMING,
  WorkerClient,
  WorkerFetchError,
} from "../../../../src/github-data/snapshot/worker-client.ts";
import { baked } from "../../../fixtures/baked-github-data.ts";
import {
  FAKE_WORKER_ORIGIN,
  type NetworkFailure,
  silentNetwork,
  testTiming,
  workerNetwork,
  workerNotFound,
  workerUnavailable,
} from "../../../fixtures/worker/network.ts";

const NOW = new Date("2026-11-04T09:40:00Z");

const PROFILE_REPLY = {
  data: {
    avatarUrl: "https://avatars.githubusercontent.com/u/4662342?v=4",
    followers: 120,
  },
  fetchedAt: new Date("2026-11-04T07:19:55Z"),
};

const RECORDED_SNAPSHOT = {
  activity: activityReply,
  contributionGraph: contributionGraphReply,
  profile: profileReply,
  repositories: repositoriesReply,
};

const NOT_FOUND_MESSAGE =
  "it says: The worker has no route at /no-such-route; it serves /activity, /contribution-graph, /profile, /repositories.";

function failingThen(...failures: NetworkFailure[]): NetworkFailure {
  return () =>
    failures.shift()?.() ?? Promise.resolve(Response.json(profileReply));
}

function client(failing: Record<string, NetworkFailure> = {}) {
  const timing = testTiming(NOW);
  const network = workerNetwork({ failing });
  return {
    client: new WorkerClient(FAKE_WORKER_ORIGIN, network, timing),
    network,
    timing,
  };
}

function cloudflareFailure(
  status: number,
  headers: Record<string, string> = {},
): NetworkFailure {
  // Cloudflare answers for the worker only when the worker cannot, which no
  // test can bring about on demand to record, so its answers are written here:
  // a body not in the worker's shape, and any Retry-After it sends.
  return () =>
    Promise.resolve(new Response("error code: 1102", { headers, status }));
}

afterEach(() => {
  vi.useRealTimers();
});

describe("SYSTEM_TIMING", () => {
  it("reads the system clock", () => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });

    expect(SYSTEM_TIMING.now()).toStrictEqual(NOW);
  });

  it("draws random numbers from 0 up to 1", () => {
    const drawn = SYSTEM_TIMING.random();

    expect([drawn >= 0, drawn < 1]).toStrictEqual([true, true]);
  });

  it("aborts an attempt once its time limit passes", async () => {
    const signal = SYSTEM_TIMING.timeout(1);

    await new Promise((resolve) => {
      signal.addEventListener("abort", resolve);
    });

    expect(signal.reason).toHaveProperty("name", "TimeoutError");
  });

  it("waits the time asked for", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    let waited = false;
    const wait = SYSTEM_TIMING.wait(1000).then(() => {
      waited = true;
    });

    await vi.advanceTimersByTimeAsync(999);
    const beforeTheEnd = waited;
    await vi.advanceTimersByTimeAsync(1);
    await wait;

    expect([beforeTheEnd, waited]).toStrictEqual([false, true]);
  });
});

describe("WorkerFetchError", () => {
  it("names itself in its text", () => {
    expect(String(new WorkerFetchError("The worker failed."))).toBe(
      "WorkerFetchError: The worker failed.",
    );
  });

  it("holds the instant it was asked to be retried at", () => {
    expect(
      new WorkerFetchError("The worker failed.", { retryAt: NOW }).retryAt,
    ).toStrictEqual(NOW);
  });
});

describe("WorkerClient.fetchSnapshot", () => {
  it("fetches every route's reply", async () => {
    const snapshot = await client().client.fetchSnapshot();

    expect(encodeSnapshot(snapshot)).toStrictEqual(RECORDED_SNAPSHOT);
  });

  it("refuses the whole snapshot when one route fails", async () => {
    const { client: worker } = client({
      "/contribution-graph": workerNotFound,
    });

    await expect(worker.fetchSnapshot()).rejects.toThrow(
      new WorkerFetchError(
        `The worker answered https://worker.example/contribution-graph with HTTP 404; ${NOT_FOUND_MESSAGE}`,
      ),
    );
  });
});

describe("WorkerClient.updateSnapshot", () => {
  const previous = {
    ...baked.snapshot,
    profile: {
      ...baked.snapshot.profile,
      fetchedAt: new Date("2026-11-01T00:00:00Z"),
    },
    repositories: {
      ...baked.snapshot.repositories,
      fetchedAt: new Date("2026-11-01T00:00:00Z"),
    },
  };

  it("replaces every route's reply when each answers", async () => {
    const { failures, snapshot } =
      await client().client.updateSnapshot(previous);

    expect([failures, encodeSnapshot(snapshot)]).toStrictEqual([
      [],
      RECORDED_SNAPSHOT,
    ]);
  });

  it("keeps the previous reply of each route that fails, and reports why, in route order", async () => {
    const { client: worker } = client({
      "/profile": cloudflareFailure(502),
      "/repositories": workerNotFound,
    });

    const { failures, snapshot } = await worker.updateSnapshot(previous);

    expect([failures, encodeSnapshot(snapshot)]).toStrictEqual([
      [
        new WorkerFetchError(
          "The worker answered https://worker.example/profile with HTTP 502, on each of 3 attempts; check its logs.",
        ),
        new WorkerFetchError(
          `The worker answered https://worker.example/repositories with HTTP 404; ${NOT_FOUND_MESSAGE}`,
        ),
      ],
      {
        ...RECORDED_SNAPSHOT,
        profile: { ...profileReply, fetchedAt: "2026-11-01T00:00:00.000Z" },
        repositories: {
          ...repositoriesReply,
          fetchedAt: "2026-11-01T00:00:00.000Z",
        },
      },
    ]);
  });

  it("lets an error that is no failed reply through as it is", async () => {
    const bug = new RangeError("a bug in the network layer");
    const { client: worker } = client({
      "/profile": () => Promise.reject(bug),
    });

    await expect(worker.updateSnapshot(previous)).rejects.toBe(bug);
  });
});

describe("WorkerClient.fetchReply", () => {
  it("fetches the route from the worker's origin and parses its reply", async () => {
    const { client: worker, network } = client();

    const reply = await worker.fetchReply(WORKER_ROUTES.profile);

    expect([reply, network.mock.calls]).toStrictEqual([
      PROFILE_REPLY,
      [[new URL("https://worker.example/profile"), expect.anything()]],
    ]);
  });

  it("gives each attempt thirty seconds, then says the worker did not answer", async () => {
    const timedOut = new DOMException(
      "The operation timed out.",
      "TimeoutError",
    );
    const signals: AbortController[] = [];
    const timing = {
      ...testTiming(NOW),
      timeout: (ms: number) => {
        const controller = new AbortController();
        signals.push(controller);
        expect(ms).toBe(30_000);
        queueMicrotask(() => {
          controller.abort(timedOut);
        });
        return controller.signal;
      },
    };

    await expect(
      new WorkerClient(FAKE_WORKER_ORIGIN, silentNetwork, timing).fetchReply(
        WORKER_ROUTES.profile,
      ),
    ).rejects.toThrow(
      new WorkerFetchError(
        "The worker did not answer https://worker.example/profile within 30 seconds, on each of 3 attempts; check that it is up.",
        { cause: timedOut },
      ),
    );
    expect([signals.length, timing.waits]).toStrictEqual([3, [750, 1500]]);
  });

  it("calls a network failure that comes once the time is up a network failure", async () => {
    const unreachable = new TypeError("fetch failed");
    const timing = {
      ...testTiming(NOW),
      timeout: () =>
        AbortSignal.abort(new DOMException("Late", "TimeoutError")),
    };

    await expect(
      new WorkerClient(
        FAKE_WORKER_ORIGIN,
        () => Promise.reject(unreachable),
        timing,
      ).fetchReply(WORKER_ROUTES.profile),
    ).rejects.toThrow(
      new WorkerFetchError(
        "Could not reach the worker at https://worker.example/profile: TypeError: fetch failed, on each of 3 attempts; check that it is up and the network is.",
        { cause: unreachable },
      ),
    );
  });

  it("retries a server error Cloudflare sent after a jittered backoff that doubles, and parses the reply that follows", async () => {
    const { client: worker, timing } = client({
      "/profile": failingThen(cloudflareFailure(502), cloudflareFailure(503)),
    });

    const reply = await worker.fetchReply(WORKER_ROUTES.profile);

    expect([reply, timing.waits]).toStrictEqual([PROFILE_REPLY, [750, 1500]]);
  });

  it("gives up on a server error Cloudflare sent after three attempts, saying so", async () => {
    const { client: worker, timing } = client({
      "/profile": cloudflareFailure(502),
    });

    await expect(worker.fetchReply(WORKER_ROUTES.profile)).rejects.toThrow(
      new WorkerFetchError(
        "The worker answered https://worker.example/profile with HTTP 502, on each of 3 attempts; check its logs.",
      ),
    );
    expect(timing.waits).toStrictEqual([750, 1500]);
  });

  it("fails at once on an error the worker sent, in the worker's words and with when it asks to be retried", async () => {
    const { client: worker, timing } = client({
      "/profile": workerUnavailable,
    });

    await expect(worker.fetchReply(WORKER_ROUTES.profile)).rejects.toThrow(
      new WorkerFetchError(
        "The worker answered https://worker.example/profile with HTTP 502; it says: " +
          "GitHub data for /profile is unavailable, and the worker has no cached reply to serve: " +
          'GitHub answered GET /users/Nusnus with 403: {"message":"API rate limit exceeded for 203.0.113.7. ' +
          "(But here's the good news: Authenticated requests get a higher rate limit. Check out the documentation for more details.)\"," +
          '"documentation_url":"https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting"}\n' +
          "GitHub allows requests again at 2026-11-04T08:20:04.000Z.\n" +
          "The worker asks GitHub again at 2026-11-04T08:20:04.000Z.",
        { retryAt: new Date("2026-11-04T10:39:59Z") },
      ),
    );
    expect(timing.waits).toStrictEqual([]);
  });

  it.each([
    ["seconds", "2", 2000],
    ["a date", "Wed, 04 Nov 2026 09:40:05 GMT", 5000],
    ["a date already past", "Wed, 04 Nov 2026 09:39:00 GMT", 0],
  ])(
    "waits as long as a Retry-After in %s asks before retrying",
    async (_, retryAfter, waitMs) => {
      const { client: worker, timing } = client({
        "/profile": failingThen(
          cloudflareFailure(503, { "Retry-After": retryAfter }),
        ),
      });

      await worker.fetchReply(WORKER_ROUTES.profile);

      expect(timing.waits).toStrictEqual([waitMs]);
    },
  );

  it("fails at once on a Retry-After longer than the client waits, saying when to try again", async () => {
    const { client: worker, timing } = client({
      "/profile": cloudflareFailure(503, { "Retry-After": "31" }),
    });

    await expect(worker.fetchReply(WORKER_ROUTES.profile)).rejects.toThrow(
      new WorkerFetchError(
        "The worker answered https://worker.example/profile with HTTP 503; it asks to be retried in 31 seconds, longer than the client waits; try again then.",
        { retryAt: new Date("2026-11-04T09:40:31Z") },
      ),
    );
    expect(timing.waits).toStrictEqual([]);
  });

  it.each([
    [
      "neither seconds nor a date",
      "soon",
      'The worker answered https://worker.example/profile with HTTP 503; its Retry-After, "soon", is neither seconds nor a date; try again later.',
    ],
    [
      "seconds with words after them",
      "2 seconds",
      'The worker answered https://worker.example/profile with HTTP 503; its Retry-After, "2 seconds", is neither seconds nor a date; try again later.',
    ],
    [
      "seconds after a letter",
      "x2",
      'The worker answered https://worker.example/profile with HTTP 503; its Retry-After, "x2", is neither seconds nor a date; try again later.',
    ],
    [
      "a fraction, which Date.parse would read as a date",
      "2.5",
      'The worker answered https://worker.example/profile with HTTP 503; its Retry-After, "2.5", is neither seconds nor a date; try again later.',
    ],
    [
      "a date not written as an IMF-fixdate",
      "2026-11-04T09:40:05Z",
      'The worker answered https://worker.example/profile with HTTP 503; its Retry-After, "2026-11-04T09:40:05Z", is neither seconds nor a date; try again later.',
    ],
  ])(
    "fails at once on a Retry-After of %s, saying it is unreadable",
    async (_, retryAfter, message) => {
      const { client: worker, timing } = client({
        "/profile": cloudflareFailure(503, { "Retry-After": retryAfter }),
      });

      await expect(worker.fetchReply(WORKER_ROUTES.profile)).rejects.toThrow(
        new WorkerFetchError(message),
      );
      expect(timing.waits).toStrictEqual([]);
    },
  );

  it("waits out a Retry-After as long as the client waits", async () => {
    const { client: worker, timing } = client({
      "/profile": failingThen(cloudflareFailure(503, { "Retry-After": "30" })),
    });

    await worker.fetchReply(WORKER_ROUTES.profile);

    expect(timing.waits).toStrictEqual([30_000]);
  });

  it("refuses a reply at once when Cloudflare answers with a client error, saying which", async () => {
    const { client: worker, timing } = client({
      "/profile": cloudflareFailure(403),
    });

    await expect(worker.fetchReply(WORKER_ROUTES.profile)).rejects.toThrow(
      new WorkerFetchError(
        "The worker answered https://worker.example/profile with HTTP 403; check its logs.",
      ),
    );
    expect(timing.waits).toStrictEqual([]);
  });

  it("reads an error JSON in another shape than the worker's as Cloudflare's", async () => {
    const { client: worker } = client({
      // Not the worker's shape, which holds its message as a string.
      "/profile": () =>
        Promise.resolve(Response.json({ error: 1102 }, { status: 403 })),
    });

    await expect(worker.fetchReply(WORKER_ROUTES.profile)).rejects.toThrow(
      new WorkerFetchError(
        "The worker answered https://worker.example/profile with HTTP 403; check its logs.",
      ),
    );
  });

  it("refuses a reply that is not JSON, at once, saying so", async () => {
    const { client: worker, network } = client({
      // No worker sends this: it stands for a page at a URL that is not the
      // worker's.
      "/profile": () => Promise.resolve(new Response("<!doctype html>")),
    });

    await expect(worker.fetchReply(WORKER_ROUTES.profile)).rejects.toThrow(
      new WorkerFetchError(
        "The worker's reply from https://worker.example/profile is not JSON; check that the URL points at the worker.",
        { cause: expect.any(SyntaxError) },
      ),
    );
    expect(network).toHaveBeenCalledTimes(1);
  });

  it("retries when the worker cannot be reached, and says why once it gives up", async () => {
    const unreachable = new TypeError("fetch failed");
    const {
      client: worker,
      network,
      timing,
    } = client({
      "/profile": () => Promise.reject(unreachable),
    });

    await expect(worker.fetchReply(WORKER_ROUTES.profile)).rejects.toThrow(
      new WorkerFetchError(
        "Could not reach the worker at https://worker.example/profile: TypeError: fetch failed, on each of 3 attempts; check that it is up and the network is.",
        { cause: unreachable },
      ),
    );
    expect([network.mock.calls.length, timing.waits]).toStrictEqual([
      3,
      [750, 1500],
    ]);
  });

  it.each([
    ["a bug", new RangeError("a bug in the network layer")],
    ["nothing", undefined],
  ])(
    "lets a rejection with %s, which is no network failure, through as it is",
    async (_, rejection) => {
      const { client: worker, network } = client({
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- A test may reject with what fetch never would.
        "/profile": () => Promise.reject(rejection),
      });

      await expect(worker.fetchReply(WORKER_ROUTES.profile)).rejects.toBe(
        rejection,
      );
      expect(network).toHaveBeenCalledTimes(1);
    },
  );

  it("gives up on a server error that keeps asking to retry after three attempts, saying so", async () => {
    const { client: worker, timing } = client({
      "/profile": cloudflareFailure(503, { "Retry-After": "2" }),
    });

    await expect(worker.fetchReply(WORKER_ROUTES.profile)).rejects.toThrow(
      new WorkerFetchError(
        "The worker answered https://worker.example/profile with HTTP 503, on each of 3 attempts; check its logs.",
        { retryAt: new Date("2026-11-04T09:40:02Z") },
      ),
    );
    expect(timing.waits).toStrictEqual([2000, 2000]);
  });

  it("refuses a reply that breaks the contract, with the contract's error", async () => {
    const { client: worker } = client({
      // Only a worker deployed from another commit sends a reply that breaks
      // the contract, which cannot be recorded on demand.
      "/profile": () =>
        Promise.resolve(Response.json({ data: profileReply.data })),
    });

    await expect(worker.fetchReply(WORKER_ROUTES.profile)).rejects.toThrow(
      new WorkerReplyError(
        "The worker's /profile reply breaks the github-data contract:\n" +
          "✖ Invalid input: expected string, received undefined\n" +
          "  → at fetchedAt\n" +
          "Deploy the worker and the site from the same commit.",
      ),
    );
  });
});
