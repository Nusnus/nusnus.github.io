/**
 * @file The contribution graph route's source: Tomer's contribution graph
 * for the last year, each day's date read from GitHub's `YYYY-MM-DD` into a
 * calendar date, refusing one not on the calendar, and its totals.
 */

import { describe, expect, it } from "vitest";

import { parseGitHubData } from "../../../src/github/failures.ts";
import {
  contributionGraphFrom,
  contributionGraphSource,
  githubContributionsSchema,
} from "../../../src/routes/contribution-graph.ts";
import { recorded } from "../../fixtures/github/fake.ts";
import { MISSHAPEN_STEP } from "../../fixtures/next-steps.ts";

const CONTRIBUTIONS = parseGitHubData(
  "data",
  githubContributionsSchema,
  (recorded("graphql/contributions").body as { data: unknown }).data,
);

function contributionsOn(date: string): unknown {
  const { user } = CONTRIBUTIONS;
  return {
    user: {
      contributionsCollection: {
        ...user.contributionsCollection,
        contributionCalendar: {
          ...user.contributionsCollection.contributionCalendar,
          weeks: [{ contributionDays: [{ contributionCount: 3, date }] }],
        },
      },
    },
  };
}

describe("githubContributionsSchema", () => {
  it("reads a day's date as a calendar date", () => {
    expect(
      parseGitHubData(
        "data",
        githubContributionsSchema,
        contributionsOn("2024-02-29"),
      ).user.contributionsCollection.contributionCalendar.weeks,
    ).toStrictEqual([
      {
        contributionDays: [
          { contributionCount: 3, date: { day: 29, month: 2, year: 2024 } },
        ],
      },
    ]);
  });

  it("refuses a day whose date is not on the calendar", () => {
    expect(() =>
      parseGitHubData(
        "data",
        githubContributionsSchema,
        contributionsOn("2025-02-29"),
      ),
    ).toThrow(
      expect.objectContaining({
        kind: "misshapen",
        message:
          "GitHub's data is not in the shape the worker reads:\n" +
          "✖ Invalid ISO date\n" +
          "  → at user.contributionsCollection.contributionCalendar.weeks[0].contributionDays[0].date\n" +
          MISSHAPEN_STEP,
        name: "GitHubError",
      }),
    );
  });
});

describe("contributionGraphSource", () => {
  it("counts its reply fresh for ten minutes", () => {
    expect(contributionGraphSource.freshForSeconds).toBe(600);
  });
});

describe("contributionGraphFrom", () => {
  it("reads the year's totals and its days, week by week", () => {
    const graph = contributionGraphFrom(CONTRIBUTIONS);

    expect({
      ...graph,
      weeks: [graph.weeks.length, graph.weeks[1], graph.weeks.at(-1)],
    }).toStrictEqual({
      totalCommits: 639,
      totalContributions: 5465,
      totalIssues: 0,
      totalPullRequests: 85,
      totalReviews: 65,
      weeks: [
        53,
        [
          { contributionCount: 1, date: { day: 9, month: 11, year: 2025 } },
          { contributionCount: 8, date: { day: 10, month: 11, year: 2025 } },
          { contributionCount: 0, date: { day: 11, month: 11, year: 2025 } },
          { contributionCount: 0, date: { day: 12, month: 11, year: 2025 } },
          { contributionCount: 1, date: { day: 13, month: 11, year: 2025 } },
          { contributionCount: 3, date: { day: 14, month: 11, year: 2025 } },
          { contributionCount: 4, date: { day: 15, month: 11, year: 2025 } },
        ],
        [
          { contributionCount: 6, date: { day: 1, month: 11, year: 2026 } },
          { contributionCount: 15, date: { day: 2, month: 11, year: 2026 } },
          { contributionCount: 21, date: { day: 3, month: 11, year: 2026 } },
          { contributionCount: 24, date: { day: 4, month: 11, year: 2026 } },
        ],
      ],
    });
  });
});
