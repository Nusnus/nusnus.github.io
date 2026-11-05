/**
 * @file The baked GitHub data the site's unit tests run against: the contract's
 * recorded worker replies, baked at 08:20 UTC the day the worker served them,
 * from the fake worker's origin. The default export is the module as the build
 * bakes it, in JSON, which Vitest serves as `virtual:baked-github-data`;
 * `baked` is that module read back, as the page reads it.
 */

import {
  activityReply,
  contributionGraphReply,
  profileReply,
  repositoriesReply,
} from "@nusnus/github-data/fixtures/worker-replies";

import {
  type EncodedBakedGitHubData,
  parseBakedGitHubData,
} from "../../src/github-data/snapshot/baked-github-data.ts";
import { FAKE_WORKER_ORIGIN } from "./worker/network.ts";

const bakedModule: EncodedBakedGitHubData = {
  bakedAt: "2026-11-04T08:20:00.000Z",
  snapshot: {
    activity: activityReply,
    contributionGraph: contributionGraphReply,
    profile: profileReply,
    repositories: repositoriesReply,
  },
  workerOrigin: FAKE_WORKER_ORIGIN.href,
};

export default bakedModule;

export const baked = parseBakedGitHubData(bakedModule);
