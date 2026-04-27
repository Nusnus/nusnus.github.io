/**
 * LiveData — invisible React island that hydrates the page with live data.
 *
 * Lifecycle on every page load:
 *  1. **Instant paint from localStorage** — last-known-good payloads are
 *     applied to the DOM and published on `window.__liveData` so React
 *     widgets that hydrate after this island still see the data.
 *  2. **Background fetch** — all worker endpoints are fetched in parallel,
 *     validated against their zod schemas, written back to localStorage,
 *     and re-published.
 *  3. **Tab refocus refresh** — when the tab becomes visible again after
 *     being hidden, fresh data is fetched.
 *  4. **Periodic refresh** — every 5 minutes while the tab is visible.
 *
 * Renders nothing — pure side-effect component.
 */

import { useEffect } from 'react';
import { fetchWorkerData } from '@lib/worker-client';
import type {
  ActivityData,
  ContributionGraphData,
  ContributionWeek,
  RepoData,
} from '@lib/github/types';
import { activitySchema, contributionGraphSchema, reposSchema } from '@lib/github/schemas';
import { formatCompactNumber, calculateStreak, relativeTime } from '@lib/utils/date';
import { readCache, writeCache, publishLiveData } from '@lib/live-cache';

const CACHE_KEYS = {
  contributions: 'contributions',
  repos: 'repos',
  orgRepos: 'org-repos',
  activity: 'activity',
} as const;

/** Refresh cadence while the tab is visible (ms). */
const PERIODIC_REFRESH_MS = 5 * 60 * 1000;

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
 * Update only if the new numeric value is greater-than-or-equal to the value
 * currently in the DOM. Used during cache-paint to avoid downgrading fresher
 * build-time values with stale localStorage values for monotonically-growing
 * counters (total contributions, commits, PRs, reviews, issues).
 */
function updateLiveIfNotLower(key: string, value: number, displayText: string) {
  document.querySelectorAll<HTMLElement>(`[data-live="${key}"]`).forEach((el) => {
    const current = parseCompactNumber(el.textContent ?? '');
    if (Number.isFinite(current) && value < current) return;
    if (el.textContent !== displayText) {
      el.textContent = displayText;
      animateRefresh(el);
    }
  });
}

/** Parse a compact number string (e.g. "1.2K", "567") back to a number. */
function parseCompactNumber(s: string): number {
  const trimmed = s.trim();
  if (!trimmed) return NaN;
  const match = /^(-?[\d.,]+)([KMBT])?$/i.exec(trimmed);
  if (!match || match[1] === undefined) return NaN;
  const n = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(n)) return NaN;
  const suffix = match[2]?.toUpperCase();
  const mult =
    suffix === 'K' ? 1e3 : suffix === 'M' ? 1e6 : suffix === 'B' ? 1e9 : suffix === 'T' ? 1e12 : 1;
  return n * mult;
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

/**
 * Apply contribution-graph payload to the DOM and publish for React widgets.
 *
 * @param source - 'cache' for localStorage paint (use monotonic guard so a
 *   stale snapshot doesn't downgrade fresher build-time values), or 'live'
 *   for worker-fetched data (always wins, source of truth).
 */
function applyContributions(graphData: ContributionGraphData, source: 'cache' | 'live') {
  const setCounter = source === 'cache' ? updateLiveIfNotLower : updateLiveAlways;
  setCounter(
    'totalContributions',
    graphData.totalContributions,
    formatCompactNumber(graphData.totalContributions),
  );
  setCounter('totalCommits', graphData.totalCommits, formatCompactNumber(graphData.totalCommits));
  setCounter('totalPRs', graphData.totalPRs, formatCompactNumber(graphData.totalPRs));
  setCounter('totalReviews', graphData.totalReviews, formatCompactNumber(graphData.totalReviews));
  setCounter('totalIssues', graphData.totalIssues, formatCompactNumber(graphData.totalIssues));

  const allDays = graphData.weeks.flatMap((w: ContributionWeek) => w.contributionDays);
  const streak = calculateStreak(allDays);
  // Streak can legitimately drop to 0, so always apply.
  updateLive('streak', String(streak));

  publishLiveData('live-data:contributions', graphData);
}

/** Adapter: ignore `value` and just call updateLive. Used in 'live' mode. */
function updateLiveAlways(key: string, _value: number, displayText: string) {
  updateLive(key, displayText);
}

/** Apply repo-list payloads to the DOM. */
function applyRepos(reposData: RepoData[] | null, orgReposData: RepoData[] | null) {
  const allRepos = [...(reposData ?? []), ...(orgReposData ?? [])];
  for (const repo of allRepos) {
    updateRepoField(repo.fullName, 'stars', formatCompactNumber(repo.stars));
    updateRepoField(repo.fullName, 'forks', formatCompactNumber(repo.forks));
    updateRepoField(repo.fullName, 'lastPush', relativeTime(repo.lastPush));
    if (repo.contributorRank != null) {
      updateRepoField(repo.fullName, 'contributorRank', `#${repo.contributorRank}`);
    }
  }

  const celery = allRepos.find((r) => r.fullName === 'celery/celery');
  if (celery) {
    updateLive('celeryStars', formatCompactNumber(celery.stars));
  }
}

/** Publish activity for ActivityFeed and StatusDot to consume. */
function applyActivity(activityData: ActivityData) {
  publishLiveData('live-data:activity', activityData);
}

export default function LiveData() {
  useEffect(() => {
    let cancelled = false;

    // ── 1. Paint cached data instantly so the page never waits on the network ──
    const cachedGraph = readCache<ContributionGraphData>(CACHE_KEYS.contributions);
    const cachedRepos = readCache<RepoData[]>(CACHE_KEYS.repos);
    const cachedOrgRepos = readCache<RepoData[]>(CACHE_KEYS.orgRepos);
    const cachedActivity = readCache<ActivityData>(CACHE_KEYS.activity);
    if (cachedGraph) applyContributions(cachedGraph, 'cache');
    if (cachedRepos || cachedOrgRepos) applyRepos(cachedRepos, cachedOrgRepos);
    if (cachedActivity) applyActivity(cachedActivity);

    // ── 2. Fetch fresh data and apply when it arrives ──
    async function refresh() {
      const [graphData, reposData, orgReposData, activityData] = await Promise.all([
        fetchWorkerData('contributions', '/data/contribution-graph.json', contributionGraphSchema),
        fetchWorkerData('repos', '/data/repos.json', reposSchema),
        fetchWorkerData('org-repos', '/data/celery-org-repos.json', reposSchema),
        fetchWorkerData('activity', '/data/activity.json', activitySchema),
      ]);

      if (cancelled) return;

      if (graphData) {
        applyContributions(graphData, 'live');
        writeCache(CACHE_KEYS.contributions, graphData);
      }
      if (reposData) writeCache(CACHE_KEYS.repos, reposData);
      if (orgReposData) writeCache(CACHE_KEYS.orgRepos, orgReposData);
      applyRepos(reposData, orgReposData);

      if (activityData) {
        applyActivity(activityData);
        writeCache(CACHE_KEYS.activity, activityData);
      }

      updateLive('lastUpdated', relativeTime(new Date().toISOString()));
    }

    refresh();

    // ── 3. Refresh when the tab becomes visible after being hidden ──
    function onVisibility() {
      if (document.visibilityState === 'visible') refresh();
    }
    document.addEventListener('visibilitychange', onVisibility);

    // ── 4. Periodic refresh while the tab is visible ──
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, PERIODIC_REFRESH_MS);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
