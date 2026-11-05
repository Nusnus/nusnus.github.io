/**
 * @file A snapshot: written to JSON and read back route by route, as the
 * worker serves each reply; as fresh as the instant its oldest reply was
 * fetched; and built from one reply per route, in the routes' order.
 */

import { describe, expect, it } from "vitest";

import {
  awaitSnapshot,
  encodeSnapshot,
  oldestFetchedAt,
  parseSnapshot,
  ROUTE_NAMES,
  snapshotFrom,
} from "../../../../src/github-data/snapshot/snapshot.ts";
import bakedModule, { baked } from "../../../fixtures/baked-github-data.ts";

describe("ROUTE_NAMES", () => {
  it("names every worker route", () => {
    expect(ROUTE_NAMES).toStrictEqual([
      "activity",
      "contributionGraph",
      "profile",
      "repositories",
    ]);
  });
});

describe("encodeSnapshot", () => {
  it("writes each route's reply as the worker serves it", () => {
    expect(encodeSnapshot(baked.snapshot)).toStrictEqual(bakedModule.snapshot);
  });
});

describe("parseSnapshot", () => {
  it("reads each route's reply, its instants as dates", () => {
    expect(parseSnapshot(bakedModule.snapshot).profile).toStrictEqual({
      data: {
        avatarUrl: "https://avatars.githubusercontent.com/u/4662342?v=4",
        followers: 120,
      },
      fetchedAt: new Date("2026-11-04T07:19:55Z"),
    });
  });
});

describe("oldestFetchedAt", () => {
  it("is when the oldest reply was fetched, whichever route it came from", () => {
    const { activity, contributionGraph, profile, repositories } =
      baked.snapshot;

    expect(
      oldestFetchedAt({
        activity: { ...activity, fetchedAt: new Date("2026-11-01T08:00:00Z") },
        contributionGraph,
        profile,
        repositories,
      }),
    ).toStrictEqual(new Date("2026-11-01T08:00:00Z"));
  });
});

describe("snapshotFrom", () => {
  it("asks for each route's reply by its route and name", () => {
    const asked: string[] = [];

    const snapshot = snapshotFrom((route, name) => {
      asked.push(`${name} ${route.path}`);
      return baked.snapshot[name];
    });

    expect([asked, snapshot]).toStrictEqual([
      [
        "activity /activity",
        "contributionGraph /contribution-graph",
        "profile /profile",
        "repositories /repositories",
      ],
      baked.snapshot,
    ]);
  });
});

describe("awaitSnapshot", () => {
  it("awaits each route's reply, asked for by its route and name", async () => {
    const asked: string[] = [];

    const snapshot = await awaitSnapshot((route, name) => {
      asked.push(`${name} ${route.path}`);
      return Promise.resolve(baked.snapshot[name]);
    });

    expect([asked, snapshot]).toStrictEqual([
      [
        "activity /activity",
        "contributionGraph /contribution-graph",
        "profile /profile",
        "repositories /repositories",
      ],
      baked.snapshot,
    ]);
  });
});
