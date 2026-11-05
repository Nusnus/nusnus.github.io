/**
 * @file Tomer's achievements: the stars across the tracked repositories, his
 * Celery rank while he holds one, each repository he created, his reviews this
 * year and his followers, the rank and creator achievements linking to his
 * commits.
 */

import { describe, expect, it } from "vitest";

import { achievements } from "../../../../src/github-data/achievements/achievements.ts";
import { baked } from "../../../fixtures/baked-github-data.ts";

describe("achievements", () => {
  it("are each count's achievement, read from the GitHub data, in the order the grid shows them", () => {
    expect(achievements(baked.snapshot)).toStrictEqual([
      {
        detail: "across maintained repos",
        emoji: "⭐",
        title: "Total Stars",
        value: "43K",
      },
      {
        detail: "celery/celery",
        emoji: "🏆",
        link: "https://github.com/celery/celery/commits?author=Nusnus",
        title: "Contributor",
        value: "#4",
      },
      {
        detail: "original author",
        emoji: "🏗️",
        link: "https://github.com/celery/pytest-celery/commits?author=Nusnus",
        title: "pytest-celery",
        value: "Creator",
      },
      {
        detail: "this year",
        emoji: "👀",
        title: "Code Reviews",
        value: "65",
      },
      {
        detail: "on GitHub",
        emoji: "👥",
        title: "Followers",
        value: "120",
      },
    ]);
  });

  it("hold no rank achievement while Tomer holds no rank in Celery", () => {
    const { repositories } = baked.snapshot;

    expect(
      achievements({
        ...baked.snapshot,
        repositories: {
          ...repositories,
          data: {
            ...repositories.data,
            "celery/celery": {
              ...repositories.data["celery/celery"],
              contributorRank: null,
            },
          },
        },
      }).map(({ title }) => title),
    ).toStrictEqual([
      "Total Stars",
      "pytest-celery",
      "Code Reviews",
      "Followers",
    ]);
  });
});
