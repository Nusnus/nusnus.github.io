/**
 * @file Tomer's achievements, as the contribution overview shows them: the
 * stars across the tracked repositories, his contributor rank in Celery's
 * repository while he holds one, each tracked repository he created, his code
 * reviews this year and his followers. An achievement with a page behind it,
 * such as his commits, links to it.
 */

import type { GitHubUrl } from "@nusnus/github-data/github-links";

import { parseFullName } from "@nusnus/github-data/formats";
import { TRACKED_REPOSITORIES } from "@nusnus/github-data/repositories";

import type { GitHubSnapshot } from "../snapshot/snapshot.ts";

import { compactCount } from "../stats/compact-count.ts";
import {
  CELERY_FULL_NAME,
  commitsUrl,
  formatRank,
} from "../stats/contributor-standing.ts";

/**
 * An achievement: its value, its emoji, its title, the detail beneath them,
 * and the page it links to, if it has one.
 */
export interface Achievement {
  readonly detail: string;
  readonly emoji: string;
  readonly link?: GitHubUrl;
  readonly title: string;
  readonly value: string;
}

export function achievements({
  contributionGraph,
  profile,
  repositories,
}: GitHubSnapshot): Achievement[] {
  const totalStars = Object.values(repositories.data).reduce(
    (sum, { stars }) => sum + stars,
    0,
  );
  const celeryRank = repositories.data[CELERY_FULL_NAME].contributorRank;
  return [
    {
      detail: "across maintained repos",
      emoji: "⭐",
      title: "Total Stars",
      value: compactCount(totalStars),
    },
    ...(celeryRank === null
      ? []
      : [
          {
            detail: CELERY_FULL_NAME,
            emoji: "🏆",
            link: commitsUrl(CELERY_FULL_NAME),
            title: "Contributor",
            value: formatRank(celeryRank),
          },
        ]),
    ...TRACKED_REPOSITORIES.filter(({ role }) => role === "creator").map(
      ({ fullName }) => ({
        detail: "original author",
        emoji: "🏗️",
        link: commitsUrl(fullName),
        title: parseFullName(fullName).name,
        value: "Creator",
      }),
    ),
    {
      detail: "this year",
      emoji: "👀",
      title: "Code Reviews",
      value: compactCount(contributionGraph.data.totalReviews),
    },
    {
      detail: "on GitHub",
      emoji: "👥",
      title: "Followers",
      value: String(profile.data.followers),
    },
  ];
}
