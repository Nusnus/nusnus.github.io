/**
 * @file The router: every path the worker serves, each with its route's
 * source, and no source for any other path.
 */

import { describe, expect, it } from "vitest";

import { activitySource } from "../../../src/routes/activity/source.ts";
import { contributionGraphSource } from "../../../src/routes/contribution-graph.ts";
import { profileSource } from "../../../src/routes/profile.ts";
import { repositoriesSource } from "../../../src/routes/repositories.ts";
import { findRouteSource, ROUTE_PATHS } from "../../../src/serving/router.ts";

describe("ROUTE_PATHS", () => {
  it("lists every path the worker serves", () => {
    expect(ROUTE_PATHS).toStrictEqual([
      "/activity",
      "/contribution-graph",
      "/profile",
      "/repositories",
    ]);
  });
});

describe("findRouteSource", () => {
  it.each([
    ["/activity", activitySource],
    ["/contribution-graph", contributionGraphSource],
    ["/profile", profileSource],
    ["/repositories", repositoriesSource],
  ])("serves %s with its route's source", (path, source) => {
    expect(findRouteSource(path)).toBe(source);
  });

  it("serves no other path", () => {
    expect(findRouteSource("/github/profile")).toBeUndefined();
  });
});
