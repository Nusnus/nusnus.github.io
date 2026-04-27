// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { refreshCache, __resetInflightRefreshForTests } from '../github';

/** Minimal in-memory `Cache`-like double. We only need `put`. */
function makeCache() {
  const store = new Map<string, Response>();
  return {
    put: vi.fn(async (req: Request, res: Response) => {
      store.set(req.url, res);
    }),
    match: vi.fn(async (req: Request) => store.get(req.url)?.clone()),
    store,
  };
}

describe('worker SWR refreshCache', () => {
  beforeEach(() => {
    __resetInflightRefreshForTests();
  });

  it('coalesces concurrent stale-cache hits into a single GitHub fetch', async () => {
    const cache = makeCache();
    const cacheKey = new Request('https://example.com/github/contributions');
    const fetcher = vi.fn(async () => {
      // Simulate latency so concurrent callers definitely overlap.
      await new Promise((r) => setTimeout(r, 10));
      return { totalContributions: 1234 };
    });

    // 25 concurrent visitors hit a stale entry simultaneously.
    await Promise.all(
      Array.from({ length: 25 }, () =>
        refreshCache(cache as never, cacheKey, fetcher, 'token', '/github/contributions'),
      ),
    );

    // Only ONE upstream GitHub fetch and ONE cache write.
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cache.put).toHaveBeenCalledTimes(1);
  });

  it('allows a fresh refresh after the previous one completes', async () => {
    const cache = makeCache();
    const cacheKey = new Request('https://example.com/github/activity');
    const fetcher = vi.fn(async () => ({ events: [] }));

    await refreshCache(cache as never, cacheKey, fetcher, 'token', '/github/activity');
    await refreshCache(cache as never, cacheKey, fetcher, 'token', '/github/activity');

    // Two sequential refreshes → two fetches.
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('clears the in-flight slot even when the upstream fetch fails', async () => {
    const cache = makeCache();
    const cacheKey = new Request('https://example.com/github/repos');
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ ok: true });

    // Suppress expected console.error
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await refreshCache(cache as never, cacheKey, fetcher, 'token', '/github/repos');
    // After failure, the next caller must be able to start a new refresh.
    await refreshCache(cache as never, cacheKey, fetcher, 'token', '/github/repos');

    expect(fetcher).toHaveBeenCalledTimes(2);
    errSpy.mockRestore();
  });

  it('coalesces independently per route key', async () => {
    const cache = makeCache();
    const k1 = new Request('https://example.com/github/contributions');
    const k2 = new Request('https://example.com/github/activity');
    const fetcher = vi.fn(async () => ({}));

    await Promise.all([
      refreshCache(cache as never, k1, fetcher, 't', '/github/contributions'),
      refreshCache(cache as never, k1, fetcher, 't', '/github/contributions'),
      refreshCache(cache as never, k2, fetcher, 't', '/github/activity'),
      refreshCache(cache as never, k2, fetcher, 't', '/github/activity'),
    ]);

    // 2 distinct route keys → 2 fetches (one per key, deduped within).
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
