/**
 * @file Baking GitHub data: the plugin serves the virtual module, which holds
 * the worker's complete snapshot, the instant it was baked and the worker's
 * origin, baked once however often the build loads it, and no module comes of
 * a snapshot the worker cannot complete. The build bakes from the deployed
 * worker unless `WORKER_ORIGIN` names a valid other.
 */

import { describe, expect, it } from "vitest";

import {
  BAKED_GITHUB_DATA_MODULE,
  bakedGitHubDataPlugin,
  parseWorkerOrigin,
} from "../../../../src/github-data/snapshot/baked-github-data.ts";
import {
  WorkerClient,
  WorkerFetchError,
} from "../../../../src/github-data/snapshot/worker-client.ts";
import bakedModule from "../../../fixtures/baked-github-data.ts";
import {
  FAKE_WORKER_ORIGIN,
  testTiming,
  workerNetwork,
  workerNotFound,
} from "../../../fixtures/worker/network.ts";

const BAKED_AT = new Date("2026-11-04T03:44:31Z");
const RESOLVED_ID = "\0virtual:baked-github-data";

function plugin(network = workerNetwork()) {
  return bakedGitHubDataPlugin(
    new WorkerClient(FAKE_WORKER_ORIGIN, network, testTiming(BAKED_AT)),
    () => BAKED_AT,
  );
}

describe("bakedGitHubDataPlugin", () => {
  it("names itself for Vite's messages", () => {
    expect(plugin().name).toBe("baked-github-data");
  });

  it("resolves the virtual module's id to the id it loads", () => {
    expect(plugin().resolveId(BAKED_GITHUB_DATA_MODULE)).toBe(RESOLVED_ID);
  });

  it("leaves every other id to the build", () => {
    const bakedData = plugin();

    expect([
      bakedData.resolveId("./snapshot.ts"),
      bakedData.load("/src/github-data/snapshot/snapshot.ts"),
    ]).toStrictEqual([undefined, undefined]);
  });

  it("loads a module that exports the snapshot, when it was baked and the worker's origin", async () => {
    const source = await plugin().load(RESOLVED_ID);
    const [, json] = /^export default (.*);\n$/s.exec(source ?? "") ?? [];

    expect(JSON.parse(json ?? "")).toStrictEqual({
      bakedAt: "2026-11-04T03:44:31.000Z",
      snapshot: bakedModule.snapshot,
      workerOrigin: "https://worker.example/",
    });
  });

  it("bakes once, however often the build loads the module", async () => {
    const network = workerNetwork();
    const bakedData = plugin(network);

    const [first, second] = await Promise.all([
      bakedData.load(RESOLVED_ID),
      bakedData.load(RESOLVED_ID),
    ]);

    expect([second, network.mock.calls.length]).toStrictEqual([first, 4]);
  });

  it("fails when the worker cannot give a complete snapshot", async () => {
    const network = workerNetwork({
      failing: {
        "/activity": workerNotFound,
      },
    });

    await expect(plugin(network).load(RESOLVED_ID)).rejects.toThrow(
      new WorkerFetchError(
        "The worker answered https://worker.example/activity with HTTP 404; it says: The worker has no route at /no-such-route; it serves /activity, /contribution-graph, /profile, /repositories.",
      ),
    );
  });
});

describe("parseWorkerOrigin", () => {
  it("is the deployed worker's origin when nothing overrides it", () => {
    expect(parseWorkerOrigin(undefined).href).toBe(
      "https://ai-proxy.tomer-nosrati.workers.dev/",
    );
  });

  it.each([
    { href: "http://localhost:5321/", override: "http://localhost:5321" },
    { href: "https://worker.example/", override: "https://worker.example" },
  ])("is $override when that overrides it", ({ href, override }) => {
    expect(parseWorkerOrigin(override).href).toBe(href);
  });

  it.each([
    {
      message:
        'WORKER_ORIGIN must be a worker\'s origin, its scheme, host and port alone, such as https://ai-proxy.tomer-nosrati.workers.dev, got "ai-proxy.tomer-nosrati.workers.dev"; unset it to use the deployed worker.',
      override: "ai-proxy.tomer-nosrati.workers.dev",
    },
    {
      message:
        'WORKER_ORIGIN must be a worker\'s origin, its scheme, host and port alone, such as https://ai-proxy.tomer-nosrati.workers.dev, got "localhost:5321"; unset it to use the deployed worker.',
      override: "localhost:5321",
    },
    {
      message:
        'WORKER_ORIGIN must be a worker\'s origin, its scheme, host and port alone, such as https://ai-proxy.tomer-nosrati.workers.dev, got "https://worker.example/profile"; unset it to use the deployed worker.',
      override: "https://worker.example/profile",
    },
  ])(
    "refuses $override, which is no web origin, saying how to recover",
    ({ message, override }) => {
      expect(() => parseWorkerOrigin(override)).toThrow(new Error(message));
    },
  );
});
