/**
 * @file A route source: how the worker fetches one route's data from GitHub,
 * and how long a cached reply of it stays fresh; and the next step when GitHub
 * knows no account by Tomer's login, for every REST read of his account.
 */

import type { WorkerRoute } from "@nusnus/github-data/routes";

import type { GitHubClient } from "../github/client.ts";

/**
 * How the worker fetches one route's data from GitHub, and for how many
 * seconds after its `fetchedAt` a cached reply of it is served without a
 * background refresh.
 */
export interface RouteSource<Data> {
  readonly freshForSeconds: number;
  readonly route: WorkerRoute<Data>;
  fetchData(github: GitHubClient): Promise<Data>;
}

export const NEXT_STEP_IF_LOGIN_NOT_FOUND =
  "Set GITHUB_LOGIN to Tomer's GitHub login.";
