/**
 * @file Live texts: the plain values the page shows from GitHub data, such as a
 * contribution total or a repository's star count, which `LiveText.astro`
 * renders as an element named by its `data-live` attributes. The live refresh
 * rewrites each one whose text the new data changes, and marks it refreshed,
 * which flashes it.
 *
 * A part of the page whose shape changes with the data, such as a list that
 * reorders, is a live island instead.
 */

import type { ContributionGraph } from "@nusnus/github-data/contribution-graph";

import {
  type Repository,
  TRACKED_REPOSITORIES,
  type TrackedFullName,
} from "@nusnus/github-data/repositories";

import type { Clock } from "../time/clock.ts";
import type { LiveData } from "./live-data-store.ts";

import { oldestFetchedAt } from "../snapshot/snapshot.ts";
import { compactCount } from "../stats/compact-count.ts";
import { contributionStreak } from "../stats/contribution-streak.ts";
import { CELERY_FULL_NAME, formatRank } from "../stats/contributor-standing.ts";

const PAGE_TEXTS = {
  totalCommits: graphTotal("totalCommits"),
  totalContributions: graphTotal("totalContributions"),
  totalIssues: graphTotal("totalIssues"),
  totalPullRequests: graphTotal("totalPullRequests"),
  totalReviews: graphTotal("totalReviews"),
  celeryStars: ({ snapshot }) =>
    compactCount(snapshot.repositories.data[CELERY_FULL_NAME].stars),
  lastUpdated: ({ clock, snapshot }) =>
    clock.timeSince(oldestFetchedAt(snapshot)),
  streak: ({ clock, snapshot }) =>
    String(contributionStreak(snapshot.contributionGraph.data, clock.today())),
} as const satisfies Record<string, (data: LiveData) => string>;

const REPOSITORY_TEXTS = {
  contributorRank: ({ contributorRank }) =>
    contributorRank === null
      ? ""
      : `${formatRank(contributorRank)} contributor`,
  forks: ({ forks }) => compactCount(forks),
  lastPush: ({ lastPush }, clock) => clock.timeSince(lastPush),
  stars: ({ stars }) => compactCount(stars),
} as const satisfies Record<
  string,
  (repository: Repository, clock: Clock) => string
>;

export type PageTextName = keyof typeof PAGE_TEXTS;

type RepositoryTextName = keyof typeof REPOSITORY_TEXTS;

/** A live text: a value about the whole data, or about one repository. */
export type LiveText =
  | { readonly name: PageTextName; readonly repository?: undefined }
  | {
      readonly name: RepositoryTextName;
      readonly repository: TrackedFullName;
    };

/** The data attributes that name a live text's element. */
export type LiveTextAttributes =
  | { readonly "data-live": PageTextName }
  | {
      readonly "data-live": RepositoryTextName;
      readonly "data-live-repository": TrackedFullName;
    };

// Set on a live text each time the live refresh changes it; LiveText.astro's
// class flashes the text while it is set.
const REFRESHED_ATTRIBUTE = "data-refreshed";

export function renderLiveText(text: LiveText, data: LiveData): string {
  return text.repository === undefined
    ? PAGE_TEXTS[text.name](data)
    : REPOSITORY_TEXTS[text.name](
        data.snapshot.repositories.data[text.repository],
        data.clock,
      );
}

export function liveTextAttributes(text: LiveText): LiveTextAttributes {
  return text.repository === undefined
    ? { "data-live": text.name }
    : { "data-live": text.name, "data-live-repository": text.repository };
}

export function patchLiveTexts(root: ParentNode, data: LiveData): void {
  for (const element of root.querySelectorAll<HTMLElement>("[data-live]")) {
    const text = renderLiveText(parseLiveText(element.dataset), data);
    if (element.textContent !== text) {
      element.textContent = text;
      markRefreshed(element);
    }
  }
}

function parseLiveText({
  live: name,
  liveRepository: repository,
}: DOMStringMap): LiveText {
  if (repository === undefined && isName(name, PAGE_TEXTS)) {
    return { name };
  }
  if (isName(name, REPOSITORY_TEXTS) && isTrackedRepository(repository)) {
    return { name, repository };
  }
  throw new Error(
    `The page has a live text named "${String(name)}"${repository === undefined ? "" : ` for "${repository}"`}, which live-text.ts does not define; render live texts with LiveText.astro.`,
  );
}

function isName<Texts extends object>(
  name: string | undefined,
  texts: Texts,
): name is Extract<keyof Texts, string> {
  return Object.hasOwn(texts, String(name));
}

function isTrackedRepository(
  fullName: string | undefined,
): fullName is TrackedFullName {
  return TRACKED_REPOSITORIES.some((tracked) => tracked.fullName === fullName);
}

function markRefreshed(element: HTMLElement): void {
  // Restarting an animation shows only in a browser, which the smoke tests
  // drive; no test DOM tells these two lines from their absence.
  // Stryker disable next-line CallExpression
  element.removeAttribute(REFRESHED_ATTRIBUTE);
  // Reading the layout makes the browser drop the old animation, so setting
  // the attribute again starts it afresh.
  // Stryker disable next-line CallExpression
  element.getBoundingClientRect();
  element.setAttribute(REFRESHED_ATTRIBUTE, "");
}

function graphTotal(
  name: Exclude<keyof ContributionGraph, "weeks">,
): (data: LiveData) => string {
  return ({ snapshot }) => compactCount(snapshot.contributionGraph.data[name]);
}
