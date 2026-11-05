/**
 * @file The tracked repositories Tomer holds a contributor rank in, best rank
 * first, ties in the order the site lists the repositories.
 */

import {
  type Repositories,
  type Repository,
  TRACKED_REPOSITORIES,
  type TrackedFullName,
} from "@nusnus/github-data/repositories";

/** A tracked repository Tomer holds a contributor rank in. */
export type RankedRepository = Repository & {
  readonly contributorRank: number;
  readonly fullName: TrackedFullName;
};

export function rankedRepositories(
  repositories: Repositories,
): RankedRepository[] {
  return TRACKED_REPOSITORIES.map(({ fullName }) => ({
    ...repositories[fullName],
    fullName,
  }))
    .filter(
      (repository): repository is RankedRepository =>
        repository.contributorRank !== null,
    )
    .toSorted(
      (first, second) => first.contributorRank - second.contributorRank,
    );
}
