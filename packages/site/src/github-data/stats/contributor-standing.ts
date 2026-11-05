/**
 * @file Tomer's standing as a contributor to the tracked repositories, as the
 * site shows it: the full name of Celery's own repository, whose stars and
 * rank the page headlines; the link to his commits in a repository; and his
 * contributor rank as it reads, such as "#4".
 */

import type { TrackedFullName } from "@nusnus/github-data/repositories";

import {
  commitsByAuthorUrl,
  type GitHubUrl,
} from "@nusnus/github-data/github-links";
import { GITHUB_LOGIN } from "@nusnus/github-data/profile";

export const CELERY_FULL_NAME = "celery/celery" satisfies TrackedFullName;

export function commitsUrl(fullName: TrackedFullName): GitHubUrl {
  return commitsByAuthorUrl(fullName, GITHUB_LOGIN);
}

export function formatRank(contributorRank: number): string {
  return `#${String(contributorRank)}`;
}
