/**
 * @file The contribution graph reply: a year of contribution days in weeks,
 * each day a real calendar date held as its parts, never as a string.
 */

import { describe, expect, it } from "vitest";

import { WORKER_ROUTES, WorkerReplyError } from "../../src/routes.ts";
import { contributionGraphReply } from "../fixtures/worker-replies.ts";

function parseDay(day: unknown): unknown {
  return WORKER_ROUTES.contributionGraph.parseReply({
    ...contributionGraphReply,
    data: { ...contributionGraphReply.data, weeks: [[day]] },
  });
}

describe("contribution graph reply", () => {
  it("holds a year of contribution days and the year's totals", () => {
    const route = WORKER_ROUTES.contributionGraph;

    expect(
      route.encodeReply(route.parseReply(contributionGraphReply)),
    ).toStrictEqual(contributionGraphReply);
  });

  it("freezes the graph, its weeks and each week, day and date", () => {
    const { data } = WORKER_ROUTES.contributionGraph.parseReply(
      contributionGraphReply,
    );
    const [week] = data.weeks;

    expect(
      [data, data.weeks, week, week?.[0], week?.[0]?.date].map(Object.isFrozen),
    ).toStrictEqual([true, true, true, true, true]);
  });

  it("accepts a leap day", () => {
    const leapDay = {
      contributionCount: 0,
      date: { day: 29, month: 2, year: 2024 },
    };

    expect(parseDay(leapDay)).toMatchObject({ data: { weeks: [[leapDay]] } });
  });

  it.each([
    { day: 29, month: 2, year: 2025 },
    { day: 1, month: 13, year: 2025 },
    { day: 366, month: 1, year: 2025 },
  ])("refuses $year-$month-$day, which is not on the calendar", (date) => {
    expect(() => parseDay({ contributionCount: 0, date })).toThrow(
      new WorkerReplyError(
        "The worker's /contribution-graph reply breaks the github-data contract:\n" +
          "✖ must be a real calendar date, with months from 1 to 12\n" +
          "  → at data.weeks[0][0].date\n" +
          "Deploy the worker and the site from the same commit.",
      ),
    );
  });

  it("refuses a date given as a string, which could be read as a UTC instant", () => {
    expect(() =>
      parseDay({ contributionCount: 0, date: "2025-11-04" }),
    ).toThrow(
      new WorkerReplyError(
        "The worker's /contribution-graph reply breaks the github-data contract:\n" +
          "✖ Invalid input: expected object, received string\n" +
          "  → at data.weeks[0][0].date\n" +
          "Deploy the worker and the site from the same commit.",
      ),
    );
  });

  it("refuses a field the site does not render", () => {
    expect(() =>
      WORKER_ROUTES.contributionGraph.parseReply({
        ...contributionGraphReply,
        data: {
          ...contributionGraphReply.data,
          restrictedContributionsCount: 0,
        },
      }),
    ).toThrow(
      new WorkerReplyError(
        "The worker's /contribution-graph reply breaks the github-data contract:\n" +
          '✖ Unrecognized key: "restrictedContributionsCount"\n' +
          "  → at data\n" +
          "Deploy the worker and the site from the same commit.",
      ),
    );
  });

  it("refuses a day with a field the site does not render", () => {
    expect(() =>
      parseDay({
        color: "#ebedf0",
        contributionCount: 0,
        date: { day: 4, month: 11, year: 2025 },
      }),
    ).toThrow(
      new WorkerReplyError(
        "The worker's /contribution-graph reply breaks the github-data contract:\n" +
          '✖ Unrecognized key: "color"\n' +
          "  → at data.weeks[0][0]\n" +
          "Deploy the worker and the site from the same commit.",
      ),
    );
  });

  it("refuses a date with a time of day", () => {
    expect(() =>
      parseDay({
        contributionCount: 0,
        date: { day: 4, hour: 0, month: 11, year: 2025 },
      }),
    ).toThrow(
      new WorkerReplyError(
        "The worker's /contribution-graph reply breaks the github-data contract:\n" +
          '✖ Unrecognized key: "hour"\n' +
          "  → at data.weeks[0][0].date\n" +
          "Deploy the worker and the site from the same commit.",
      ),
    );
  });
});
