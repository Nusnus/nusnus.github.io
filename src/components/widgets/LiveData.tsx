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

/** Trigger the data-refresh animation on an element. */
function animateRefresh(el: HTMLElement) {
  el.classList.remove('data-refresh');
  // Force reflow so re-adding the class restarts the animation
  void el.offsetWidth;
  el.classList.add('data-refresh');
}

/** Update all DOM elements matching `[data-live="key"]` with the given text. */
function updateLive(key: string, text: string) {
  document.querySelectorAll<HTMLElement>(`[data-live="${key}"]`).forEach((el) => {
    if (el.textContent !== text) {
      el.textContent = text;
      animateRefresh(el);
    }
  });
}

/**
 * Parse a compact number string back to a number (e.g. "2.3K" → 2300, "294" → 294).
 * Returns 0 if parsing fails.
 */
function parseDisplayedNumber(text: string): number {
  const cleaned = text.trim().replace(/,/g, '');
  const match = cleaned.match(/^([0-9.]+)\s*([KkMm]?)$/);
  if (!match) return 0;
  const num = parseFloat(match[1] ?? '0');
  const suffix = (match[2] ?? '').toUpperCase();
  if (suffix === 'K') return num * 1_000;
  if (suffix === 'M') return num * 1_000_000;
  return num;
}

/**
 * Only update a live element if the new numeric value is >= the currently displayed value.
 * Prevents stale worker cache from overwriting correct static data with lower numbers.
 */
function updateLiveIfHigher(key: string, value: number, formatted: string) {
  document.querySelectorAll<HTMLElement>(`[data-live="${key}"]`).forEach((el) => {
    const current = parseDisplayedNumber(el.textContent ?? '0');
    if (value >= current && el.textContent !== formatted) {
      el.textContent = formatted;
      animateRefresh(el);
    }
  });
}

/** Update repo-specific DOM elements. */
function updateRepoField(repoFullName: string, field: string, text: string) {
  document
    .querySelectorAll<HTMLElement>(`[data-live-repo="${repoFullName}"][data-live-field="${field}"]`)
    .forEach((el) => {
      if (el.textContent !== text) {
        el.textContent = text;
        animateRefresh(el);
      }
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
        updateLiveIfHigher(
          'totalContributions',
          graphData.totalContributions,
          formatCompactNumber(graphData.totalContributions),
        );
        updateLiveIfHigher(
          'totalCommits',
          graphData.totalCommits,
          formatCompactNumber(graphData.totalCommits),
        );
        updateLiveIfHigher('totalPRs', graphData.totalPRs, formatCompactNumber(graphData.totalPRs));
        updateLiveIfHigher(
          'totalReviews',
          graphData.totalReviews,
          formatCompactNumber(graphData.totalReviews),
        );
        updateLiveIfHigher(
          'totalIssues',
          graphData.totalIssues,
          formatCompactNumber(graphData.totalIssues),
        );

        // Compute streak client-side
        const allDays = graphData.weeks.flatMap((w) => w.contributionDays);
        const streak = calculateStreak(allDays);
        updateLiveIfHigher('streak', streak, String(streak));

        // Broadcast weeks data for React chart widgets only if data is fresh
        const currentEl = document.querySelector<HTMLElement>('[data-live="totalContributions"]');
        const currentVal = parseDisplayedNumber(currentEl?.textContent ?? '0');
        if (graphData.totalContributions >= currentVal) {
          window.dispatchEvent(new CustomEvent('live-data:contributions', { detail: graphData }));
        }
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
