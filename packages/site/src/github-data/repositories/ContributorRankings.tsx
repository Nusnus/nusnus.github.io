/**
 * @file The contributor rankings: each tracked repository Tomer holds a rank
 * in, best rank first, as a link to the repository showing its name and his
 * rank. The default export is the live island, which reorders the list as the
 * ranks change.
 */

import type { Repositories } from "@nusnus/github-data/repositories";

import { parseFullName } from "@nusnus/github-data/formats";
import { repositoryUrl } from "@nusnus/github-data/github-links";

import { Caption } from "../../design-system/Caption.tsx";
import { linkTarget } from "../../design-system/link-target.ts";
import { liveIsland } from "../live/live-island.tsx";
import { formatRank } from "../stats/contributor-standing.ts";
import { rankedRepositories } from "./ranked-repositories.ts";

export function ContributorRankings({
  repositories,
}: {
  repositories: Repositories;
}) {
  const ranked = rankedRepositories(repositories);
  if (ranked.length === 0) {
    return null;
  }
  return (
    <>
      <Caption className="mb-2">Contributor Rankings</Caption>
      <ol className="space-y-1">
        {ranked.map(({ contributorRank, fullName }) => (
          <li key={fullName}>
            <a
              className="group flex items-center justify-between rounded-md px-2 py-1 transition-colors duration-100 hover:bg-bg-surface"
              href={repositoryUrl(fullName)}
              {...linkTarget(repositoryUrl(fullName))}
            >
              <span className="font-mono text-xs text-text-secondary transition-colors group-hover:text-text-primary">
                {parseFullName(fullName).name}
              </span>
              <span className="font-mono text-xs font-semibold text-accent">
                {formatRank(contributorRank)}
              </span>
            </a>
          </li>
        ))}
      </ol>
    </>
  );
}

export default liveIsland(ContributorRankings, ({ snapshot }) => ({
  repositories: snapshot.repositories.data,
}));
