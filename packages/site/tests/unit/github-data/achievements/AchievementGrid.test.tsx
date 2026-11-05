/**
 * @file The achievement grid: each achievement as a tile under the
 * "Achievements" caption, one with a page behind it a link that opens in a new
 * tab and lifts on hover while the rest stay still; and, as an island, the
 * page's achievements.
 */

import { describe, expect, it } from "vitest";

import AchievementGridIsland, {
  AchievementGrid,
} from "../../../../src/github-data/achievements/AchievementGrid.tsx";
import { baked } from "../../../fixtures/baked-github-data.ts";
import { render, screen } from "../../../fixtures/unit-page.ts";

function tiles(container: HTMLElement): (null | string)[][] {
  return [...container.querySelectorAll(".grid > *")].map((tile) => [
    tile.tagName,
    tile.textContent,
    tile.getAttribute("href"),
  ]);
}

describe("AchievementGrid", () => {
  it("shows each achievement under the caption, linking those with a page behind them", () => {
    const { container } = render(<AchievementGrid snapshot={baked.snapshot} />);

    expect([
      screen.getByText("Achievements").tagName,
      tiles(container),
    ]).toStrictEqual([
      "P",
      [
        ["DIV", "⭐43KTotal Starsacross maintained repos", null],
        [
          "A",
          "🏆#4Contributorcelery/celery",
          "https://github.com/celery/celery/commits?author=Nusnus",
        ],
        [
          "A",
          "🏗️Creatorpytest-celeryoriginal author",
          "https://github.com/celery/pytest-celery/commits?author=Nusnus",
        ],
        ["DIV", "👀65Code Reviewsthis year", null],
        ["DIV", "👥120Followerson GitHub", null],
      ],
    ]);
  });

  it("draws every achievement as a tile, and lifts a linked one on hover while the others stay still", () => {
    const { container } = render(<AchievementGrid snapshot={baked.snapshot} />);

    expect(
      [...container.querySelectorAll(".grid > *")].map((tile) => [
        tile.classList.contains("rounded-lg") &&
          tile.classList.contains("ring-1"),
        tile.classList.contains("hover:-translate-y-0.5"),
      ]),
    ).toStrictEqual([
      [true, false],
      [true, true],
      [true, true],
      [true, false],
      [true, false],
    ]);
  });

  it("opens a linked achievement in a new tab", () => {
    render(<AchievementGrid snapshot={baked.snapshot} />);

    expect(
      screen.getAllByRole("link").map((link) => link.getAttribute("target")),
    ).toStrictEqual(["_blank", "_blank"]);
  });

  it("shows the page's achievements as an island", () => {
    const { container } = render(<AchievementGridIsland />);

    expect(tiles(container)).toHaveLength(5);
  });
});
