/**
 * @file Live texts: each renders its value from the live data, in the format
 * the page shows it in; its element carries the attributes that name it; and
 * patching rewrites and marks refreshed each text the data changes, leaves the
 * rest as they are, and refuses an element no live text defines.
 */

import { repositoriesReply } from "@nusnus/github-data/fixtures/worker-replies";
import { WORKER_ROUTES } from "@nusnus/github-data/routes";
import { describe, expect, it } from "vitest";

import type { LiveData } from "../../../../src/github-data/live/live-data-store.ts";

import {
  liveTextAttributes,
  patchLiveTexts,
  renderLiveText,
} from "../../../../src/github-data/live/live-text.ts";
import { Clock } from "../../../../src/github-data/time/clock.ts";
import { baked } from "../../../fixtures/baked-github-data.ts";

const BAKED: LiveData = {
  clock: new Clock(new Date("2026-11-04T08:20:00Z"), "UTC"),
  freshness: "baked",
  snapshot: baked.snapshot,
};

function withCelery(stars: number, contributorRank: null | number): LiveData {
  return {
    ...BAKED,
    snapshot: {
      ...baked.snapshot,
      repositories: WORKER_ROUTES.repositories.parseReply({
        ...repositoriesReply,
        data: {
          ...repositoriesReply.data,
          "celery/celery": {
            ...repositoriesReply.data["celery/celery"],
            contributorRank,
            stars,
          },
        },
      }),
    },
  };
}

describe("renderLiveText", () => {
  it.each([
    ["celeryStars", "29K"],
    ["lastUpdated", "1 hour ago"],
    ["streak", "12"],
    ["totalCommits", "639"],
    ["totalContributions", "5.5K"],
    ["totalIssues", "0"],
    ["totalPullRequests", "85"],
    ["totalReviews", "65"],
  ] as const)("renders %s as %s", (name, text) => {
    expect(renderLiveText({ name }, BAKED)).toBe(text);
  });

  it.each([
    ["contributorRank", "#4 contributor"],
    ["forks", "5.3K"],
    ["lastPush", "10 hours ago"],
    ["stars", "29K"],
  ] as const)("renders a repository's %s as %s", (name, text) => {
    expect(renderLiveText({ name, repository: "celery/celery" }, BAKED)).toBe(
      text,
    );
  });

  it("renders no rank for a repository Tomer holds none in", () => {
    expect(
      renderLiveText(
        { name: "contributorRank", repository: "celery/celery" },
        withCelery(29_133, null),
      ),
    ).toBe("");
  });
});

describe("liveTextAttributes", () => {
  it("names a text by its name, and a repository's by its repository too", () => {
    expect([
      liveTextAttributes({ name: "streak" }),
      liveTextAttributes({ name: "stars", repository: "mher/flower" }),
    ]).toStrictEqual([
      { "data-live": "streak" },
      { "data-live": "stars", "data-live-repository": "mher/flower" },
    ]);
  });
});

describe("patchLiveTexts", () => {
  function renderTexts(): HTMLElement[] {
    document.body.innerHTML = `
      <span data-live="celeryStars">29K</span>
      <span data-live="stars" data-live-repository="celery/celery">29K</span>
      <span data-live="contributorRank" data-live-repository="celery/celery">#4 contributor</span>
      <span data-live="totalCommits">639</span>`;
    return [...document.querySelectorAll<HTMLElement>("[data-live]")];
  }

  it("rewrites and marks refreshed each text the data changes, and leaves the rest as they are", () => {
    const elements = renderTexts();

    patchLiveTexts(document, withCelery(31_000, 3));

    expect(
      elements.map((element) => [
        element.textContent,
        element.getAttribute("data-refreshed"),
      ]),
    ).toStrictEqual([
      ["31K", ""],
      ["31K", ""],
      ["#3 contributor", ""],
      ["639", null],
    ]);
  });

  it("marks a text refreshed again when it changes again", () => {
    const [celeryStars] = renderTexts();
    patchLiveTexts(document, withCelery(31_000, 4));

    patchLiveTexts(document, withCelery(32_000, 4));

    expect([
      celeryStars?.textContent,
      celeryStars?.getAttribute("data-refreshed"),
    ]).toStrictEqual(["32K", ""]);
  });

  it.each([
    [
      '<span data-live="followers"></span>',
      'The page has a live text named "followers", which live-text.ts does not define; render live texts with LiveText.astro.',
    ],
    [
      '<span data-live="streak" data-live-repository="celery/celery"></span>',
      'The page has a live text named "streak" for "celery/celery", which live-text.ts does not define; render live texts with LiveText.astro.',
    ],
    [
      '<span data-live="stars" data-live-repository="celery/cell"></span>',
      'The page has a live text named "stars" for "celery/cell", which live-text.ts does not define; render live texts with LiveText.astro.',
    ],
    [
      '<span data-live="stars"></span>',
      'The page has a live text named "stars", which live-text.ts does not define; render live texts with LiveText.astro.',
    ],
    [
      '<span data-live="toString"></span>',
      'The page has a live text named "toString", which live-text.ts does not define; render live texts with LiveText.astro.',
    ],
    [
      '<span data-live=""></span>',
      'The page has a live text named "", which live-text.ts does not define; render live texts with LiveText.astro.',
    ],
  ])("refuses %s, which no live text defines", (html, message) => {
    document.body.innerHTML = html;

    expect(() => {
      patchLiveTexts(document, BAKED);
    }).toThrow(new Error(message));
  });
});
