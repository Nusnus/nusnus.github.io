// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, act, screen } from '@testing-library/react';
import ActivityFeed from '@components/widgets/ActivityFeed';
import { publishLiveData } from '@lib/live-cache';
import type { ActivityEvent, ActivityData } from '@lib/github/types';

function makeEvent(id: string, type = 'PushEvent'): ActivityEvent {
  return {
    id,
    type,
    repo: 'celery/celery',
    title: `commit ${id}`,
    url: `https://github.com/celery/celery/commit/${id}`,
    createdAt: '2026-04-27T20:00:00Z',
  };
}

beforeEach(() => {
  (window as unknown as { __liveData?: Record<string, unknown> }).__liveData = {};
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ActivityFeed', () => {
  it('caps live updates to 10 events even when worker returns more', async () => {
    const initial: ActivityEvent[] = [makeEvent('seed-1')];
    render(<ActivityFeed initialEvents={initial} />);

    // Worker payload has 99 events — we should only render the first 10.
    const big: ActivityData = {
      events: Array.from({ length: 99 }, (_, i) => makeEvent(`live-${i}`)),
      todaySummary: { commits: 0, prsOpened: 0, prsReviewed: 0, issueComments: 0 },
    };
    await act(async () => {
      publishLiveData('live-data:activity', big);
    });

    const links = screen.getAllByRole('link');
    expect(links.length).toBe(10);
    // Confirms we picked the first slice.
    expect(links[0]?.getAttribute('href')).toContain('live-0');
    expect(links[9]?.getAttribute('href')).toContain('live-9');
  });

  it('renders the empty state (not skeletons) when live activity is empty', async () => {
    render(<ActivityFeed initialEvents={[]} />);

    // Before any live publish: skeletons (we have no fallback either).
    const empty: ActivityData = {
      events: [],
      todaySummary: { commits: 0, prsOpened: 0, prsReviewed: 0, issueComments: 0 },
    };
    await act(async () => {
      publishLiveData('live-data:activity', empty);
    });

    // After live resolves to []: empty-state, not infinite skeleton.
    expect(screen.getByText(/no recent activity/i)).toBeTruthy();
    expect(screen.queryAllByRole('link').length).toBe(0);
  });

  it('shows fallback events until live data arrives, then swaps', async () => {
    const initial: ActivityEvent[] = [makeEvent('seed-1')];
    render(<ActivityFeed initialEvents={initial} />);

    // Initially, we render the seed.
    expect(screen.getAllByRole('link')[0]?.getAttribute('href')).toContain('seed-1');

    // After live publish, the seed is replaced by live events.
    const live: ActivityData = {
      events: [makeEvent('live-1'), makeEvent('live-2')],
      todaySummary: { commits: 0, prsOpened: 0, prsReviewed: 0, issueComments: 0 },
    };
    await act(async () => {
      publishLiveData('live-data:activity', live);
    });

    const links = screen.getAllByRole('link');
    expect(links.length).toBe(2);
    expect(links[0]?.getAttribute('href')).toContain('live-1');
  });
});
