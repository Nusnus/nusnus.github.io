/**
 * @file The responses the fake worker network and the smoke tests' worker
 * replay answer with: the contract's recorded worker replies, each at the path
 * of the route that served it, as JSON open to every origin, and for any other
 * path the worker's recorded 404, which names the path it was recorded for.
 */

import type { ExchangeResponse } from "@nusnus/github-data/fixtures/exchange";

import {
  activityReply,
  contributionGraphReply,
  noSuchRouteExchange,
  profileExchange,
  profileReply,
  repositoriesReply,
} from "@nusnus/github-data/fixtures/worker-replies";
import {
  WORKER_ROUTES,
  type WorkerRouteName,
} from "@nusnus/github-data/routes";

import { ROUTE_NAMES } from "../../../src/github-data/snapshot/snapshot.ts";

const RECORDED_REPLIES: Readonly<Record<WorkerRouteName, unknown>> = {
  activity: activityReply,
  contributionGraph: contributionGraphReply,
  profile: profileReply,
  repositories: repositoriesReply,
};

const REPLIES_BY_PATH: ReadonlyMap<string, unknown> = new Map(
  ROUTE_NAMES.map((name) => [WORKER_ROUTES[name].path, RECORDED_REPLIES[name]]),
);

// Only the profile reply was recorded whole, with its headers; these two of
// them the worker sends with every route's reply, while the rest, such as its
// entity tag, describe that one reply.
const REPLY_HEADERS = {
  "access-control-allow-origin":
    profileExchange.headers["access-control-allow-origin"],
  "content-type": profileExchange.headers["content-type"],
};

export function recordedResponseAt(pathname: string): ExchangeResponse {
  const reply = REPLIES_BY_PATH.get(pathname);
  return reply === undefined
    ? noSuchRouteExchange
    : { body: reply, headers: REPLY_HEADERS, status: 200 };
}
