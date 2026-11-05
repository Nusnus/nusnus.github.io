/**
 * @file The contribution graph route's source: Tomer's contribution graph
 * for the last year and its totals, from GitHub's GraphQL API in one query,
 * each day's date read from GitHub's `YYYY-MM-DD` into a calendar date.
 */

import { calendarDateSchema } from "@nusnus/github-data/calendar";
import { type ContributionGraph } from "@nusnus/github-data/contribution-graph";
import { countSchema } from "@nusnus/github-data/formats";
import { GITHUB_LOGIN } from "@nusnus/github-data/profile";
import { WORKER_ROUTES } from "@nusnus/github-data/routes";
import * as schema from "@nusnus/github-data/schema";

import type { RouteSource } from "./route-source.ts";

// `contributionsCollection` covers the year up to now when given no range:
// https://docs.github.com/en/graphql/reference/objects#user
const CONTRIBUTIONS_QUERY = `query ($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { contributionCount date } }
      }
      totalCommitContributions
      totalIssueContributions
      totalPullRequestContributions
      totalPullRequestReviewContributions
    }
  }
}`;

const githubDateSchema = schema.pipe(
  schema.pipe(
    schema.iso.date(),
    schema.transform((isoDate: string) => ({
      day: Number(isoDate.slice(8)),
      month: Number(isoDate.slice(5, 7)),
      year: Number(isoDate.slice(0, 4)),
    })),
  ),
  calendarDateSchema,
);

export const githubContributionsSchema = schema.object({
  user: schema.object({
    contributionsCollection: schema.object({
      contributionCalendar: schema.object({
        totalContributions: countSchema,
        weeks: schema.array(
          schema.object({
            contributionDays: schema.array(
              schema.object({
                contributionCount: countSchema,
                date: githubDateSchema,
              }),
            ),
          }),
        ),
      }),
      totalCommitContributions: countSchema,
      totalIssueContributions: countSchema,
      totalPullRequestContributions: countSchema,
      totalPullRequestReviewContributions: countSchema,
    }),
  }),
});

/**
 * Tomer's contributions as GitHub's GraphQL API sends them, in the part the
 * site shows.
 */
export type GitHubContributions = schema.Infer<
  typeof githubContributionsSchema
>;

export const contributionGraphSource: RouteSource<ContributionGraph> = {
  // A day's count moves with each contribution, but the graph shows a year;
  // the query costs one request.
  freshForSeconds: 600,
  route: WORKER_ROUTES.contributionGraph,
  async fetchData(github) {
    return contributionGraphFrom(
      await github.query(
        CONTRIBUTIONS_QUERY,
        { login: GITHUB_LOGIN },
        githubContributionsSchema,
      ),
    );
  },
};

export function contributionGraphFrom({
  user: { contributionsCollection: collection },
}: GitHubContributions): ContributionGraph {
  return {
    totalCommits: collection.totalCommitContributions,
    totalContributions: collection.contributionCalendar.totalContributions,
    totalIssues: collection.totalIssueContributions,
    totalPullRequests: collection.totalPullRequestContributions,
    totalReviews: collection.totalPullRequestReviewContributions,
    weeks: collection.contributionCalendar.weeks.map(
      ({ contributionDays }) => contributionDays,
    ),
  };
}
