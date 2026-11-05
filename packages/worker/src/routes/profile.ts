/**
 * @file The profile route's source: Tomer's avatar and follower count, from
 * GitHub's users API.
 */

import { countSchema } from "@nusnus/github-data/formats";
import {
  avatarUrlSchema,
  GITHUB_LOGIN,
  type Profile,
} from "@nusnus/github-data/profile";
import { WORKER_ROUTES } from "@nusnus/github-data/routes";
import * as schema from "@nusnus/github-data/schema";

import {
  NEXT_STEP_IF_LOGIN_NOT_FOUND,
  type RouteSource,
} from "./route-source.ts";

export const githubUserSchema = schema.object({
  avatar_url: avatarUrlSchema,
  followers: countSchema,
});

/**
 * Tomer's account as GitHub's users API sends it, in the part the site shows.
 */
export type GitHubUser = schema.Infer<typeof githubUserSchema>;

export const profileSource: RouteSource<Profile> = {
  // The follower count moves slowly and costs one request to refresh.
  freshForSeconds: 600,
  route: WORKER_ROUTES.profile,
  async fetchData(github) {
    return profileFrom(
      await github.get({
        nextStepIfNotFound: NEXT_STEP_IF_LOGIN_NOT_FOUND,
        pathAndQuery: `/users/${GITHUB_LOGIN}`,
        replySchema: githubUserSchema,
      }),
    );
  },
};

export function profileFrom(user: GitHubUser): Profile {
  return { avatarUrl: user.avatar_url, followers: user.followers };
}
