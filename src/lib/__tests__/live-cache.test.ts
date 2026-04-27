// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  readCache,
  writeCache,
  readStash,
  publishLiveData,
  LIVE_CACHE_MAX_AGE_MS,
} from '@lib/live-cache';

beforeEach(() => {
  window.localStorage.clear();
  (window as unknown as { __liveData?: Record<string, unknown> }).__liveData = {};
  vi.useRealTimers();
});

describe('live-cache localStorage layer', () => {
  it('returns null when no entry exists', () => {
    expect(readCache('missing')).toBeNull();
  });

  it('round-trips a value', () => {
    writeCache('contributions', { totalContributions: 42 });
    expect(readCache<{ totalContributions: number }>('contributions')).toEqual({
      totalContributions: 42,
    });
  });

  it('expires entries older than LIVE_CACHE_MAX_AGE_MS', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    writeCache('repos', [{ id: 1 }]);

    // Advance past the expiry window
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z').getTime() + LIVE_CACHE_MAX_AGE_MS + 1);
    expect(readCache('repos')).toBeNull();
  });

  it('returns null on malformed entries', () => {
    window.localStorage.setItem('nusnus:live:bad', 'not-json{');
    expect(readCache('bad')).toBeNull();
  });
});

describe('live-cache window stash', () => {
  it('readStash returns undefined when nothing is published', () => {
    expect(readStash('live-data:contributions')).toBeUndefined();
  });

  it('publishLiveData stashes and dispatches', () => {
    const handler = vi.fn();
    window.addEventListener('live-data:contributions', handler);
    publishLiveData('live-data:contributions', { totalContributions: 1 });
    expect(readStash('live-data:contributions')).toEqual({ totalContributions: 1 });
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener('live-data:contributions', handler);
  });
});
