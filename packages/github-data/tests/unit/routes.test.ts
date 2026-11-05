/**
 * @file The worker's routes: a route's URL at a worker's origin; a route reads
 * a reply from JSON into its data and the instant the worker fetched it,
 * frozen, and writes it back; a reply the site receives that breaks the
 * contract is refused, saying to deploy the worker and the site together, and
 * one the worker builds that breaks it is refused, saying to fix how the
 * worker builds it; where the worker is deployed, and each route's path; and
 * the body of the worker's errors, its message and nothing else.
 */

import { describe, expect, it } from "vitest";

import { countSchema } from "../../src/formats.ts";
import {
  WORKER_ORIGIN,
  WORKER_ROUTES,
  workerErrorSchema,
  WorkerReplyError,
  WorkerRoute,
} from "../../src/routes.ts";
import * as schema from "../../src/schema.ts";

const STARS = new WorkerRoute(
  "/stars",
  schema.strictObject({ stars: countSchema }),
);
const STARS_REPLY = {
  data: { stars: 29_133 },
  fetchedAt: "2026-11-04T07:19:55.000Z",
};

describe("WorkerRoute.urlAt", () => {
  it("places the route's path at the origin", () => {
    expect(STARS.urlAt("https://worker.test")).toStrictEqual(
      new URL("https://worker.test/stars"),
    );
  });
});

describe("WorkerRoute.parseReply", () => {
  it("returns the data and the instant the worker fetched it, frozen", () => {
    const reply = STARS.parseReply(STARS_REPLY);

    expect([reply, Object.isFrozen(reply)]).toStrictEqual([
      { data: { stars: 29_133 }, fetchedAt: new Date("2026-11-04T07:19:55Z") },
      true,
    ]);
  });

  it("refuses a reply without the instant the worker fetched it, saying to deploy the worker and the site together", () => {
    expect(() => STARS.parseReply({ data: STARS_REPLY.data })).toThrow(
      new WorkerReplyError(
        "The worker's /stars reply breaks the github-data contract:\n" +
          "✖ Invalid input: expected string, received undefined\n" +
          "  → at fetchedAt\n" +
          "Deploy the worker and the site from the same commit.",
      ),
    );
  });

  it("refuses a reply with a field the contract does not hold", () => {
    expect(() => STARS.parseReply({ ...STARS_REPLY, status: "ok" })).toThrow(
      new WorkerReplyError(
        "The worker's /stars reply breaks the github-data contract:\n" +
          '✖ Unrecognized key: "status"\n' +
          "Deploy the worker and the site from the same commit.",
      ),
    );
  });
});

describe("WorkerRoute.encodeReply", () => {
  it("writes the data and the instant the worker fetched it as JSON", () => {
    expect(
      STARS.encodeReply({
        data: STARS.parseReply(STARS_REPLY).data,
        fetchedAt: new Date("2026-11-04T07:19:55Z"),
      }),
    ).toStrictEqual(STARS_REPLY);
  });

  it("refuses a reply the worker built that breaks the contract, saying to fix how it builds it", () => {
    const reply = STARS.parseReply(STARS_REPLY);

    expect(() =>
      STARS.encodeReply({ ...reply, fetchedAt: new Date(Number.NaN) }),
    ).toThrow(
      new WorkerReplyError(
        "The worker built a /stars reply that breaks the github-data contract:\n" +
          "✖ Invalid input: expected date, received Date\n" +
          "  → at fetchedAt\n" +
          "Fix how the worker's route source for /stars builds it.",
      ),
    );
  });
});

describe("WORKER_ORIGIN", () => {
  it("is the deployed worker's address", () => {
    expect(WORKER_ORIGIN).toBe("https://ai-proxy.tomer-nosrati.workers.dev");
  });
});

describe("WORKER_ROUTES", () => {
  it("serves each kind of GitHub data at its own path", () => {
    expect(
      Object.fromEntries(
        Object.entries(WORKER_ROUTES).map(([name, route]) => [
          name,
          route.path,
        ]),
      ),
    ).toStrictEqual({
      activity: "/activity",
      contributionGraph: "/contribution-graph",
      profile: "/profile",
      repositories: "/repositories",
    });
  });
});

describe("workerErrorSchema", () => {
  it("accepts an error's message", () => {
    expect(
      schema.parse(
        workerErrorSchema,
        { error: "The worker has no route at /github/profile." },
        (issues) => new Error(issues),
      ),
    ).toStrictEqual({ error: "The worker has no route at /github/profile." });
  });

  it("refuses a field beside the message", () => {
    expect(() =>
      schema.parse(
        workerErrorSchema,
        { error: "The worker has no route at /github/profile.", status: 404 },
        (issues) => new Error(issues),
      ),
    ).toThrow(new Error('✖ Unrecognized key: "status"'));
  });
});
