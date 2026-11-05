/**
 * @file A snapshot of GitHub data: one reply from each of the worker's routes,
 * which the build bakes into the page and the browser refreshes; how it is
 * written to JSON and read back, through each route; and when its oldest reply
 * was fetched. `snapshotFrom` and `awaitSnapshot` build one route by route, so
 * no other code lists the routes, and a new route joins every snapshot at once.
 */

import {
  type EncodedWorkerReply,
  WORKER_ROUTES,
  type WorkerReply,
  type WorkerRoute,
  type WorkerRouteData,
  type WorkerRouteName,
} from "@nusnus/github-data/routes";

/** One reply from each worker route. */
export type GitHubSnapshot = {
  readonly [Name in WorkerRouteName]: RouteReply<Name>;
};

/** A snapshot as it travels, in JSON. */
export type EncodedSnapshot = Readonly<
  Record<WorkerRouteName, EncodedWorkerReply>
>;

/** Each worker route, typed by the data it serves. */
export type SnapshotRoutes = {
  readonly [Name in WorkerRouteName]: WorkerRoute<WorkerRouteData<Name>>;
};

/** The reply a worker route serves. */
export type RouteReply<Name extends WorkerRouteName> = WorkerReply<
  WorkerRouteData<Name>
>;

// Typing the routes by name lets a function generic in a route's name read the
// route and its reply as one type:
// https://github.com/microsoft/TypeScript/pull/47109
const ROUTES: SnapshotRoutes = WORKER_ROUTES;

// Object.keys types its keys as strings, though these are the routes' names.
export const ROUTE_NAMES = Object.keys(ROUTES) as readonly WorkerRouteName[];

export function encodeSnapshot(snapshot: GitHubSnapshot): EncodedSnapshot {
  // Object.fromEntries cannot say its keys are every route's name.
  return Object.fromEntries(
    ROUTE_NAMES.map((name) => [
      name,
      encodeReply(ROUTES[name], snapshot[name]),
    ]),
  ) as EncodedSnapshot;
}

export function parseSnapshot(encoded: EncodedSnapshot): GitHubSnapshot {
  return snapshotFrom((route, name) => route.parseReply(encoded[name]));
}

export function oldestFetchedAt(snapshot: GitHubSnapshot): Date {
  return new Date(
    Math.min(
      ...Object.values(snapshot).map(({ fetchedAt }) => fetchedAt.getTime()),
    ),
  );
}

export function snapshotFrom(
  replyOf: <Name extends WorkerRouteName>(
    route: SnapshotRoutes[Name],
    name: Name,
  ) => RouteReply<Name>,
): GitHubSnapshot {
  // Object.fromEntries cannot type each key's value; `replyOf` typed each.
  return Object.fromEntries(
    ROUTE_NAMES.map((name) => [name, replyOf(ROUTES[name], name)]),
  ) as GitHubSnapshot;
}

export async function awaitSnapshot(
  replyOf: <Name extends WorkerRouteName>(
    route: SnapshotRoutes[Name],
    name: Name,
  ) => Promise<RouteReply<Name>>,
): Promise<GitHubSnapshot> {
  const replies = await Promise.all(
    ROUTE_NAMES.map(async (name) => [name, await replyOf(ROUTES[name], name)]),
  );
  // Object.fromEntries cannot type each key's value; `replyOf` typed each.
  return Object.fromEntries(replies) as GitHubSnapshot;
}

function encodeReply<Name extends WorkerRouteName>(
  route: SnapshotRoutes[Name],
  reply: RouteReply<Name>,
): EncodedWorkerReply {
  return route.encodeReply(reply);
}
