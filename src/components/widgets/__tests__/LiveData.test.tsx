// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, act, waitFor } from '@testing-library/react';
import LiveData from '@components/widgets/LiveData';
import { writeCache, readStash } from '@lib/live-cache';
import { __resetInflightCacheForTests } from '@lib/worker-client';
import type { ContributionGraphData, ActivityData } from '@lib/github/types';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const SAMPLE_GRAPH: ContributionGraphData = {
  totalContributions: 1234,
  totalCommits: 567,
  totalPRs: 89,
  totalReviews: 12,
  totalIssues: 3,
  weeks: [
    {
      contributionDays: [
        { date: '2026-04-26', contributionCount: 4, weekday: 0 },
        { date: '2026-04-27', contributionCount: 7, weekday: 1 },
      ],
    },
  ],
};

const SAMPLE_ACTIVITY: ActivityData = {
  events: [
    {
      id: 'e1',
      type: 'PushEvent',
      repo: 'celery/celery',
      title: 'fix: thing',
      url: 'https://github.com/celery/celery/commit/abc',
      createdAt: '2026-04-27T20:00:00Z',
    },
  ],
  todaySummary: { commits: 1, prsOpened: 0, prsReviewed: 0, issueComments: 0 },
};

const EMPTY_REPOS: never[] = [];

function setupHostElements() {
  document.body.innerHTML = `
    <p data-live="totalContributions">0</p>
    <p data-live="totalCommits">0</p>
    <p data-live="totalPRs">0</p>
    <p data-live="totalReviews">0</p>
    <p data-live="totalIssues">0</p>
    <p data-live="streak">0</p>
    <p data-live="celeryStars">0</p>
    <p data-live="lastUpdated">never</p>
  `;
}

function mockFetch(graph = SAMPLE_GRAPH, activity = SAMPLE_ACTIVITY) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const u = String(url);
    if (u.includes('/github/contributions') || u.endsWith('/data/contribution-graph.json')) {
      return jsonResponse(graph);
    }
    if (u.includes('/github/activity') || u.endsWith('/data/activity.json')) {
      return jsonResponse(activity);
    }
    if (
      u.includes('/github/repos') ||
      u.includes('/github/org-repos') ||
      u.endsWith('/data/repos.json') ||
      u.endsWith('/data/celery-org-repos.json')
    ) {
      return jsonResponse(EMPTY_REPOS);
    }
    return jsonResponse({}, 404);
  });
}

beforeEach(() => {
  window.localStorage.clear();
  (window as unknown as { __liveData?: Record<string, unknown> }).__liveData = {};
  __resetInflightCacheForTests();
  setupHostElements();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('LiveData', () => {
  it('paints localStorage cache before the worker responds', async () => {
    writeCache('contributions', SAMPLE_GRAPH);
    // Worker fetch never resolves so we exercise the cache-paint path alone.
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise<Response>(() => {
          /* never resolves */
        }),
    );

    render(<LiveData />);

    // Cache paint is synchronous inside useEffect.
    await act(async () => {
      /* flush effects */
    });

    expect(document.querySelector('[data-live="totalContributions"]')?.textContent).toBe('1.2K');
    expect(readStash('live-data:contributions')).toEqual(SAMPLE_GRAPH);
  });

  it('fetches all endpoints and publishes contributions + activity', async () => {
    const fetchSpy = mockFetch();

    render(<LiveData />);

    await waitFor(() => {
      expect(readStash('live-data:contributions')).toEqual(SAMPLE_GRAPH);
    });
    expect(readStash('live-data:activity')).toEqual(SAMPLE_ACTIVITY);
    expect(document.querySelector('[data-live="totalCommits"]')?.textContent).toBe('567');
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('refreshes on visibilitychange when the tab becomes visible', async () => {
    const fetchSpy = mockFetch();
    render(<LiveData />);
    await waitFor(() => {
      expect(readStash('live-data:contributions')).toEqual(SAMPLE_GRAPH);
    });

    const beforeCount = fetchSpy.mock.calls.length;
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => {
      expect(fetchSpy.mock.calls.length).toBeGreaterThan(beforeCount);
    });
  });

  it('skips invalid worker responses (schema validation)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes('/github/')) return jsonResponse({ totally: 'invalid' });
      return jsonResponse(EMPTY_REPOS);
    });

    render(<LiveData />);
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });
    // Let any micro-pending publish settle
    await new Promise((r) => setTimeout(r, 20));

    // Nothing valid was published — DOM stays at the initial host values.
    expect(document.querySelector('[data-live="totalContributions"]')?.textContent).toBe('0');
    expect(readStash('live-data:contributions')).toBeUndefined();
  });
});
