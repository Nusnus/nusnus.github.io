/**
 * @file Built contribution graphs are shaped as the worker's: calendar weeks
 * from Sunday, oldest first, none for no days, and the total; counts the
 * contract refuses build none.
 */

import { describe, expect, it } from "vitest";

import { contributionGraph } from "../../fixtures/contribution-graphs.ts";

describe("contributionGraph", () => {
  it("holds the days in weeks from Sunday, and their total", () => {
    const graph = contributionGraph(
      { day: 6, month: 11, year: 2026 },
      [1, 2, 3],
    );

    expect([graph.weeks, graph.totalContributions]).toStrictEqual([
      [
        [
          {
            contributionCount: 1,
            date: { day: 6, month: 11, year: 2026 },
          },
          {
            contributionCount: 2,
            date: { day: 7, month: 11, year: 2026 },
          },
        ],
        [
          {
            contributionCount: 3,
            date: { day: 8, month: 11, year: 2026 },
          },
        ],
      ],
      6,
    ]);
  });

  it("holds no weeks for no days", () => {
    const graph = contributionGraph({ day: 6, month: 11, year: 2026 }, []);

    expect([graph.weeks, graph.totalContributions]).toStrictEqual([[], 0]);
  });

  it("refuses counts the contract refuses, naming the issue", () => {
    expect(() =>
      contributionGraph({ day: 6, month: 11, year: 2026 }, [3, -1]),
    ).toThrow(
      new Error(
        "These daily counts make a contribution graph the contract refuses; give counts it accepts:\n" +
          "✖ Too small: expected number to be >=0\n" +
          "  → at weeks[0][1].contributionCount",
      ),
    );
  });
});
