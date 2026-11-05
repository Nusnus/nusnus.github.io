/**
 * @file The contribution streak: consecutive contributing days up to today,
 * which a day without contributions breaks, except today while it is under way;
 * days after the visitor's today count.
 */

import { describe, expect, it } from "vitest";

import { contributionStreak } from "../../../../src/github-data/stats/contribution-streak.ts";
import { baked } from "../../../fixtures/baked-github-data.ts";
import { contributionGraph } from "../../../fixtures/contribution-graphs.ts";

const NOVEMBER_4 = { day: 4, month: 11, year: 2026 };

describe("contributionStreak", () => {
  it("counts the recorded graph's run of contributing days up to its last", () => {
    expect(
      contributionStreak(baked.snapshot.contributionGraph.data, NOVEMBER_4),
    ).toBe(12);
  });

  it.each([
    { counts: [0, 1, 2, 3], run: "ends today", streak: 3 },
    {
      counts: [0, 1, 2, 0],
      run: "ran to yesterday, while today has none yet",
      streak: 2,
    },
    { counts: [5, 0, 1, 0], run: "broke the day before yesterday", streak: 1 },
    { counts: [5, 5, 0, 0], run: "broke yesterday", streak: 0 },
    {
      counts: [5, 0, 1, 1],
      run: "broke two days ago, after a day without",
      streak: 2,
    },
  ])("is $streak for a run that $run", ({ counts, streak }) => {
    expect(
      contributionStreak(
        contributionGraph({ day: 1, month: 11, year: 2026 }, counts),
        NOVEMBER_4,
      ),
    ).toBe(streak);
  });

  it("counts days after the visitor's today, from a graph in a zone ahead", () => {
    expect(
      contributionStreak(
        contributionGraph({ day: 2, month: 11, year: 2026 }, [1, 1, 1, 1]),
        NOVEMBER_4,
      ),
    ).toBe(4);
  });

  it("is nothing for a graph that ended days ago", () => {
    expect(
      contributionStreak(
        contributionGraph({ day: 20, month: 10, year: 2026 }, [1, 1, 1]),
        NOVEMBER_4,
      ),
    ).toBe(0);
  });
});
