/**
 * LiveData — invisible React island that hydrates the page with live data.
 *
 * On mount, fetches all worker endpoints in parallel and:
 * 1. Updates DOM elements with `data-live="key"` attributes (text stats)
 * 2. Updates repo-specific elements with `data-live-repo` + `data-live-field`
 * 3. Dispatches a 'live-data:contributions' CustomEvent for React chart widgets
 *
 * Renders nothing — pure side-effect component.
 */

import { useEffect } from 'react';
import { fetchWorkerData } from '@lib/worker-client';
import type { ContributionGraphData, RepoData } from '@lib/github/types';
import { formatCompactNumber, calculateStreak, relativeTime } from '@lib/utils/date';

/** Update all DOM elements matching `[data-live="key"]` with the given text. */
function updateLive(key: string, text: string) {
  document.querySelectorAll<HTMLElement>(`[data-live="${key}"]`).forEach((el) => {
    el.textContent = text;
  });
}

/** Update repo-specific DOM elements. */
function updateRepoField(repoFullName: string, field: string, text: string) {
  document
    .querySelectorAll<HTMLElement>(`[data-live-repo="${repoFullName}"][data-live-field="${field}"]`)
    .forEach((el) => {
      el.textContent = text;
    });
}

export default function LiveData() {
  useEffect(() => {
    async function refresh() {
      const [graphData, reposData, orgReposData] = await Promise.all([
        fetchWorkerData<ContributionGraphData>('contributions', '/data/contribution-graph.json'),
        fetchWorkerData<RepoData[]>('repos', '/data/repos.json'),
        fetchWorkerData<RepoData[]>('org-repos', '/data/celery-org-repos.json'),
      ]);

      // ── Contribution stats ──
      if (graphData) {
        updateLive('totalContributions', formatCompactNumber(graphData.totalContributions));
        updateLive('totalCommits', formatCompactNumber(graphData.totalCommits));
        updateLive('totalPRs', formatCompactNumber(graphData.totalPRs));
        updateLive('totalReviews', formatCompactNumber(graphData.totalReviews));
        updateLive('totalIssues', formatCompactNumber(graphData.totalIssues));

        // Compute streak client-side
        const allDays = graphData.weeks.flatMap((w) => w.contributionDays);
        const streak = calculateStreak(allDays);
        updateLive('streak', String(streak));

        // Broadcast weeks data for React chart widgets
        window.dispatchEvent(new CustomEvent('live-data:contributions', { detail: graphData }));
      }

      // ── Repo stats (active projects + org repos) ──
      const allRepos = [...(reposData ?? []), ...(orgReposData ?? [])];
      for (const repo of allRepos) {
        updateRepoField(repo.fullName, 'stars', formatCompactNumber(repo.stars));
        updateRepoField(repo.fullName, 'forks', formatCompactNumber(repo.forks));
        updateRepoField(repo.fullName, 'lastPush', relativeTime(repo.lastPush));
        if (repo.contributorRank != null) {
          updateRepoField(repo.fullName, 'contributorRank', `#${repo.contributorRank}`);
        }
      }

      // ── Celery stars in sidebar ──
      const celery = allRepos.find((r) => r.fullName === 'celery/celery');
      if (celery) {
        updateLive('celeryStars', formatCompactNumber(celery.stars));
      }

      // ── Last updated timestamp ──
      updateLive('lastUpdated', relativeTime(new Date().toISOString()));
    }

    refresh();
  }, []);

  return null;
}
