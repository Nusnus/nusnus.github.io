/**
 * @file The router: which route source serves each path the github-data
 * contract defines, one for each worker route, and every path the worker
 * serves.
 */

import type {
  WorkerRouteData,
  WorkerRouteName,
} from "@nusnus/github-data/routes";

import type { RouteSource } from "../routes/route-source.ts";

import { activitySource } from "../routes/activity/source.ts";
import { contributionGraphSource } from "../routes/contribution-graph.ts";
import { profileSource } from "../routes/profile.ts";
import { repositoriesSource } from "../routes/repositories.ts";

const ROUTE_SOURCES: {
  readonly [Name in WorkerRouteName]: RouteSource<WorkerRouteData<Name>>;
} = {
  activity: activitySource,
  contributionGraph: contributionGraphSource,
  profile: profileSource,
  repositories: repositoriesSource,
};

const SOURCES_BY_PATH: ReadonlyMap<string, RouteSource<unknown>> = new Map(
  Object.values(ROUTE_SOURCES).map((source) => [source.route.path, source]),
);

export const ROUTE_PATHS: readonly string[] = [...SOURCES_BY_PATH.keys()];

export function findRouteSource(
  path: string,
): RouteSource<unknown> | undefined {
  return SOURCES_BY_PATH.get(path);
}
