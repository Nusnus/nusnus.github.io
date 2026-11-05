/**
 * @file The repositories route's source: GitHub's data on every tracked
 * repository, and Tomer's rank among each one's contributors, read page by page
 * until he is found, the list ends or GitHub's ranks do. A repository GitHub
 * fails to answer for, or knows by another name, fails the whole reply.
 */

import {
  countSchema,
  type FullName,
  fullNameSchema,
  instantSchema,
} from "@nusnus/github-data/formats";
import { GITHUB_LOGIN } from "@nusnus/github-data/profile";
import {
  type Repositories,
  type Repository,
  TRACKED_REPOSITORIES,
  type TrackedFullName,
} from "@nusnus/github-data/repositories";
import { WORKER_ROUTES } from "@nusnus/github-data/routes";
import * as schema from "@nusnus/github-data/schema";

import type { GitHubClient } from "../github/client.ts";
import type { RouteSource } from "./route-source.ts";

import { GitHubError } from "../github/failures.ts";

// The most contributors GitHub lists on one page.
const CONTRIBUTORS_PER_PAGE = 100;

// GitHub links only a repository's first 500 author emails to users, so it
// cannot rank anyone past that; reading on would spend requests for nothing:
// https://docs.github.com/en/rest/repos/repos#list-repository-contributors
const MAX_CONTRIBUTOR_PAGES = 500 / CONTRIBUTORS_PER_PAGE;

const NEXT_STEP_IF_REPOSITORY_NOT_FOUND =
  "Remove it from TRACKED_REPOSITORIES.";

export const githubRepositorySchema = schema.object({
  description: schema.nullable(schema.string()),
  forks_count: countSchema,
  full_name: fullNameSchema,
  language: schema.nullable(schema.string()),
  pushed_at: instantSchema,
  stargazers_count: countSchema,
});

/**
 * A repository as GitHub's repositories API sends it, in the part the site
 * shows.
 */
export type GitHubRepository = schema.Infer<typeof githubRepositorySchema>;

export const githubContributorsSchema = schema.array(
  schema.object({ login: schema.string() }),
);

/** One page of a repository's contributors, most commits first. */
export type GitHubContributors = schema.Infer<typeof githubContributorsSchema>;

export const repositoriesSource: RouteSource<Repositories> = {
  // Each refresh costs at least two requests per tracked repository, the
  // most of any route, and stars, forks and ranks move slowly.
  freshForSeconds: 900,
  route: WORKER_ROUTES.repositories,
  async fetchData(github) {
    const repositories = await Promise.all(
      TRACKED_REPOSITORIES.map(
        async ({ fullName }) =>
          [fullName, await fetchRepository(github, fullName)] as const,
      ),
    );
    // Object.fromEntries types its keys as any string; the entries hold
    // every tracked repository, as encoding the reply checks.
    return Object.fromEntries(repositories) as Record<
      TrackedFullName,
      Repository
    >;
  },
};

async function fetchRepository(
  github: GitHubClient,
  fullName: TrackedFullName,
): Promise<Repository> {
  const [repository, contributorRank] = await Promise.all([
    github.get({
      nextStepIfNotFound: NEXT_STEP_IF_REPOSITORY_NOT_FOUND,
      pathAndQuery: `/repos/${fullName}`,
      replySchema: githubRepositorySchema,
    }),
    fetchContributorRank(github, fullName),
  ]);
  return repositoryFrom(fullName, repository, contributorRank);
}

async function fetchContributorRank(
  github: GitHubClient,
  fullName: TrackedFullName,
): Promise<null | number> {
  for (let page = 1; ; page += 1) {
    const rank = rankOnPage(
      page,
      await github.get({
        nextStepIfNotFound: NEXT_STEP_IF_REPOSITORY_NOT_FOUND,
        pathAndQuery: contributorsPage(fullName, page),
        // Any short page without Tomer ranks no one, so no test can tell an
        // empty list from another.
        // Stryker disable next-line ArrayDeclaration
        replyIfNoContent: [],
        replySchema: githubContributorsSchema,
      }),
    );
    if (rank !== "next page") {
      return rank;
    }
  }
}

export function contributorsPage(
  fullName: FullName,
  page: number,
): `/${string}` {
  return `/repos/${fullName}/contributors?per_page=${String(CONTRIBUTORS_PER_PAGE)}&page=${String(page)}`;
}

export function repositoryFrom(
  fullName: TrackedFullName,
  repository: GitHubRepository,
  contributorRank: null | number,
): Repository {
  // GitHub redirects a request for a renamed repository to the repository
  // under its new name, and fetch follows the redirect:
  // https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api#follow-redirects
  if (repository.full_name !== fullName) {
    throw GitHubError.notFound(
      `GitHub knows the tracked repository ${fullName} as ${repository.full_name} now.`,
      "Rename it in TRACKED_REPOSITORIES.",
    );
  }
  return {
    contributorRank,
    description: repository.description,
    forks: repository.forks_count,
    language: repository.language,
    lastPush: repository.pushed_at,
    stars: repository.stargazers_count,
  };
}

export function rankOnPage(
  page: number,
  contributors: GitHubContributors,
): "next page" | null | number {
  const index = contributors.findIndex(({ login }) => login === GITHUB_LOGIN);
  if (index !== -1) {
    return (page - 1) * CONTRIBUTORS_PER_PAGE + index + 1;
  }
  return contributors.length < CONTRIBUTORS_PER_PAGE ||
    page === MAX_CONTRIBUTOR_PAGES
    ? null
    : "next page";
}
