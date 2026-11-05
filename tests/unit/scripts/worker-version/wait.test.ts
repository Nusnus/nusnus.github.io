/**
 * @file The wait for a deployed worker version, on the fake network: it passes
 * once the worker's profile route names the version, giving each request the
 * site's build's limit; it asks again after a wait that doubles up to its
 * longest while the worker names another version, none, or cannot be
 * reached; it fails once the limit would pass, saying what the worker answered
 * last and which run to rerun, and fails without a version to wait for; and an
 * error it does not expect escapes.
 */

import type { Exchange } from "@nusnus/github-data/fixtures/exchange";

import { profileExchange } from "@nusnus/github-data/fixtures/worker-replies";
import { describe, expect, it } from "vitest";

import {
  awaitWorkerVersion,
  type WaitDependencies,
} from "../../../../scripts/worker-version/wait.ts";
import {
  receivedRequests,
  replayServices,
  silence,
  unreachable,
  useFakeNetwork,
} from "../../../fixtures/services/network.ts";

useFakeNetwork();

const PROFILE_URL = "https://ai-proxy.tomer-nosrati.workers.dev/profile";
// The version the contract's profile exchange names.
const DEPLOYED = "0e1f4789-4064-4773-80b2-67a5e0d3f1c2";
// The worker's answers while an older version serves, and from a worker
// deployed before it named its version. Neither can be recorded on demand, so
// each edits the recorded profile exchange's version header.
const PREVIOUS_VERSION: Exchange = {
  ...profileExchange,
  headers: {
    ...profileExchange.headers,
    "worker-version": "7b8d00a1-3887-4cf6-a8b2-2e5c4d6f0a91",
  },
};
const NO_VERSION: Exchange = {
  ...profileExchange,
  headers: Object.fromEntries(
    Object.entries(profileExchange.headers).filter(
      ([name]) => name !== "worker-version",
    ),
  ),
};

function dependenciesWith({
  answerMs = [],
  networkAfterEachWait = [],
}: {
  readonly answerMs?: readonly number[];
  readonly networkAfterEachWait?: readonly (() => void)[];
} = {}): {
  dependencies: WaitDependencies;
  timeouts: number[];
  waits: number[];
} {
  let now = new Date("2026-11-04T05:17:00Z");
  const answerTimes = [...answerMs];
  const timeouts: number[] = [];
  const waits: number[] = [];
  return {
    dependencies: {
      fetch: async (input, init) => {
        const response = await fetch(input, init);
        now = new Date(now.getTime() + (answerTimes.shift() ?? 0));
        return response;
      },
      now: () => now,
      timeout: (ms) => {
        timeouts.push(ms);
        return new AbortController().signal;
      },
      wait: (ms) => {
        networkAfterEachWait[waits.length]?.();
        waits.push(ms);
        now = new Date(now.getTime() + ms);
        return Promise.resolve();
      },
    },
    timeouts,
    waits,
  };
}

async function awaitDeployed(dependencies: WaitDependencies) {
  const lines: string[] = [];
  const exitCode = await awaitWorkerVersion(
    { WORKER_VERSION_ID: DEPLOYED },
    dependencies,
    (line) => lines.push(line),
  );
  return { exitCode, lines };
}

describe("awaitWorkerVersion", () => {
  it("passes once the worker's profile route names the version, giving the request the build's limit", async () => {
    replayServices(profileExchange);
    const { dependencies, timeouts, waits } = dependenciesWith();

    expect([
      await awaitDeployed(dependencies),
      receivedRequests().map(({ headers, url }) => ({
        authorization: headers["authorization"],
        url,
      })),
      timeouts,
      waits,
    ]).toStrictEqual([
      {
        exitCode: 0,
        lines: [
          "The worker at https://ai-proxy.tomer-nosrati.workers.dev serves version 0e1f4789-4064-4773-80b2-67a5e0d3f1c2.",
        ],
      },
      [{ authorization: undefined, url: PROFILE_URL }],
      [30_000],
      [],
    ]);
  });

  it("asks again after a wait that doubles up to ten seconds, while the worker names another version, none, or cannot be reached", async () => {
    replayServices(PREVIOUS_VERSION);
    const { dependencies, waits } = dependenciesWith({
      networkAfterEachWait: [
        () => {
          replayServices(NO_VERSION);
        },
        () => {
          unreachable(PROFILE_URL);
        },
        () => {
          replayServices(PREVIOUS_VERSION);
        },
        () => {
          replayServices(PREVIOUS_VERSION);
        },
        () => {
          replayServices(PREVIOUS_VERSION);
        },
        () => {
          replayServices(profileExchange);
        },
      ],
    });

    expect([(await awaitDeployed(dependencies)).exitCode, waits]).toStrictEqual(
      [0, [1000, 2000, 4000, 8000, 10_000, 10_000]],
    );
  });

  it("counts the time its answers take, and still waits when a wait would end just at the limit", async () => {
    replayServices(PREVIOUS_VERSION);
    // The worker's first answer takes five seconds, after which each wait
    // ends on a whole ten seconds, the last one just at the limit.
    const { dependencies, waits } = dependenciesWith({ answerMs: [5000] });

    expect([(await awaitDeployed(dependencies)).exitCode, waits]).toStrictEqual(
      [
        1,
        [
          1000, 2000, 4000, 8000, 10_000, 10_000, 10_000, 10_000, 10_000,
          10_000, 10_000, 10_000, 10_000, 10_000,
        ],
      ],
    );
  });

  it.each([
    {
      line: "The worker at https://ai-proxy.tomer-nosrati.workers.dev does not serve version 0e1f4789-4064-4773-80b2-67a5e0d3f1c2 after 120 seconds of waiting: when last asked, it served version 7b8d00a1-3887-4cf6-a8b2-2e5c4d6f0a91. Rerun the newest Deploy run's failed jobs, or dispatch a new run, since an older run waits for a version a newer run has replaced; if this fails again, check the worker's deployments in the Cloudflare dashboard's Workers & Pages.",
      worker: "an older version",
      answer: () => {
        replayServices(PREVIOUS_VERSION);
      },
    },
    {
      line: "The worker at https://ai-proxy.tomer-nosrati.workers.dev does not serve version 0e1f4789-4064-4773-80b2-67a5e0d3f1c2 after 120 seconds of waiting: when last asked, it named no version. Rerun the newest Deploy run's failed jobs, or dispatch a new run, since an older run waits for a version a newer run has replaced; if this fails again, check the worker's deployments in the Cloudflare dashboard's Workers & Pages.",
      worker: "no version",
      answer: () => {
        replayServices(NO_VERSION);
      },
    },
    {
      line: "The worker at https://ai-proxy.tomer-nosrati.workers.dev does not serve version 0e1f4789-4064-4773-80b2-67a5e0d3f1c2 after 120 seconds of waiting: when last asked, it could not be reached: TypeError: fetch failed. Rerun the newest Deploy run's failed jobs, or dispatch a new run, since an older run waits for a version a newer run has replaced; if this fails again, check the worker's deployments in the Cloudflare dashboard's Workers & Pages.",
      worker: "an unreachable worker",
      answer: () => {
        unreachable(PROFILE_URL);
      },
    },
    {
      line: "The worker at https://ai-proxy.tomer-nosrati.workers.dev does not serve version 0e1f4789-4064-4773-80b2-67a5e0d3f1c2 after 120 seconds of waiting: when last asked, it gave no answer within 30 seconds. Rerun the newest Deploy run's failed jobs, or dispatch a new run, since an older run waits for a version a newer run has replaced; if this fails again, check the worker's deployments in the Cloudflare dashboard's Workers & Pages.",
      worker: "a silent worker",
      answer: () => {
        silence(PROFILE_URL);
      },
    },
  ])(
    "fails from $worker once two minutes of waits would pass, saying what it answered last and which run to rerun",
    async ({ answer, line }) => {
      answer();
      const { dependencies, waits } = dependenciesWith();

      expect([await awaitDeployed(dependencies), waits]).toStrictEqual([
        { exitCode: 1, lines: [line] },
        [
          1000, 2000, 4000, 8000, 10_000, 10_000, 10_000, 10_000, 10_000,
          10_000, 10_000, 10_000, 10_000, 10_000,
        ],
      ]);
    },
  );

  it.each([
    { env: {}, variable: "unset" },
    { env: { WORKER_VERSION_ID: "" }, variable: "empty" },
  ])(
    "fails without asking the worker while WORKER_VERSION_ID is $variable, saying where it comes from",
    async ({ env }) => {
      replayServices(profileExchange);
      const lines: string[] = [];

      const exitCode = await awaitWorkerVersion(
        env,
        dependenciesWith().dependencies,
        (line) => lines.push(line),
      );

      expect({
        exitCode,
        lines,
        requests: receivedRequests(),
      }).toStrictEqual({
        exitCode: 1,
        lines: [
          "Set WORKER_VERSION_ID to the id of the worker version to wait for, as the Deploy workflow does from Wrangler's report of its deploy.",
        ],
        requests: [],
      });
    },
  );

  it("lets an error it does not expect escape", async () => {
    const { dependencies } = dependenciesWith();

    await expect(
      // A fault of the wait's own, which no network sends.
      awaitDeployed({
        ...dependencies,
        fetch: () => Promise.reject(new RangeError("a bug")),
      }),
    ).rejects.toThrow(new RangeError("a bug"));
  });
});
