// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import StatusDot from '@components/widgets/StatusDot';
import { publishLiveData } from '@lib/live-cache';
import type { ActivityData } from '@lib/github/types';

beforeEach(() => {
  (window as unknown as { __liveData?: Record<string, unknown> }).__liveData = {};
  vi.useRealTimers();
});

afterEach(() => cleanup());

function activityAt(timestamp: string): ActivityData {
  return {
    events: [
      {
        id: 'x',
        type: 'PushEvent',
        repo: 'celery/celery',
        title: 't',
        url: 'https://github.com',
        createdAt: timestamp,
      },
    ],
    todaySummary: { commits: 0, prsOpened: 0, prsReviewed: 0, issueComments: 0 },
  };
}

describe('StatusDot', () => {
  it('renders "active" today when initial timestamp is today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-27T12:00:00Z'));
    const { container } = render(<StatusDot initialTimestamp="2026-04-27T08:00:00Z" />);
    expect(container.querySelector('.bg-status-active')).toBeTruthy();
    expect(container.querySelector('.sr-only')?.textContent).toBe('Active today');
  });

  it('renders "Away" when initial timestamp is far in the past', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-27T12:00:00Z'));
    const { container } = render(<StatusDot initialTimestamp="2026-01-01T00:00:00Z" />);
    expect(container.querySelector('.bg-status-inactive')).toBeTruthy();
    expect(container.querySelector('.sr-only')?.textContent).toBe('Away');
  });

  it('updates to live timestamp when LiveData publishes activity', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-27T12:00:00Z'));
    const { container } = render(<StatusDot initialTimestamp="2026-01-01T00:00:00Z" />);
    expect(container.querySelector('.bg-status-inactive')).toBeTruthy();

    act(() => {
      publishLiveData('live-data:activity', activityAt('2026-04-27T11:00:00Z'));
    });

    expect(container.querySelector('.bg-status-active')).toBeTruthy();
  });

  it('reads stash synchronously when published before mount (late hydration)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-27T12:00:00Z'));
    publishLiveData('live-data:activity', activityAt('2026-04-27T08:00:00Z'));
    const { container } = render(<StatusDot initialTimestamp="2026-01-01T00:00:00Z" />);
    expect(container.querySelector('.bg-status-active')).toBeTruthy();
  });
});
