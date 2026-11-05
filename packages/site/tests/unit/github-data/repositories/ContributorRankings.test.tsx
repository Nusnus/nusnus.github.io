/**
 * @file The contributor rankings: under their caption, an ordered list of
 * links to the repositories Tomer holds a rank in, each with its name and
 * rank, opening in a new tab; nothing when he holds none; and, as an island,
 * the page's ranks.
 */

import type { Repositories } from "@nusnus/github-data/repositories";

import { describe, expect, it } from "vitest";

import ContributorRankingsIsland, {
  ContributorRankings,
} from "../../../../src/github-data/repositories/ContributorRankings.tsx";
import { baked } from "../../../fixtures/baked-github-data.ts";
import { render, screen } from "../../../fixtures/unit-page.ts";

describe("ContributorRankings", () => {
  it("links to each ranked repository under the caption, best first, with its rank", () => {
    render(
      <ContributorRankings repositories={baked.snapshot.repositories.data} />,
    );

    expect([
      screen.getByText("Contributor Rankings").tagName,
      screen
        .getAllByRole("link")
        .map((link) => [
          link.textContent,
          link.getAttribute("href"),
          link.getAttribute("target"),
        ]),
    ]).toStrictEqual([
      "P",
      [
        [
          "pytest-celery#1",
          "https://github.com/celery/pytest-celery",
          "_blank",
        ],
        ["celery#4", "https://github.com/celery/celery", "_blank"],
        [
          "celeryproject#4",
          "https://github.com/celery/celeryproject",
          "_blank",
        ],
        ["billiard#5", "https://github.com/celery/billiard", "_blank"],
        [
          "sphinx_celery#5",
          "https://github.com/celery/sphinx_celery",
          "_blank",
        ],
        ["vine#7", "https://github.com/celery/vine", "_blank"],
        ["kombu#8", "https://github.com/celery/kombu", "_blank"],
        ["py-amqp#9", "https://github.com/celery/py-amqp", "_blank"],
        [
          "django-celery-beat#19",
          "https://github.com/celery/django-celery-beat",
          "_blank",
        ],
        ["librabbitmq#25", "https://github.com/celery/librabbitmq", "_blank"],
        ["flower#25", "https://github.com/mher/flower", "_blank"],
        [
          "django-celery-results#33",
          "https://github.com/celery/django-celery-results",
          "_blank",
        ],
      ],
    ]);
  });

  it("renders nothing when Tomer holds no rank", () => {
    // Object.fromEntries cannot say its keys are every tracked repository's.
    const unranked = Object.fromEntries(
      Object.entries(baked.snapshot.repositories.data).map(
        ([fullName, repository]) => [
          fullName,
          { ...repository, contributorRank: null },
        ],
      ),
    ) as Repositories;

    const { container } = render(
      <ContributorRankings repositories={unranked} />,
    );

    expect(container.innerHTML).toBe("");
  });

  it("lists the page's ranks as an island", () => {
    render(<ContributorRankingsIsland />);

    expect(screen.getAllByRole("listitem")).toHaveLength(12);
  });
});
