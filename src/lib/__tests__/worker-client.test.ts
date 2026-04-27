// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod/v4';
import { fetchWorkerData } from '@lib/worker-client';

const schema = z.object({ value: z.number() });

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('fetchWorkerData', () => {
  it('returns parsed data when worker responds with valid JSON', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ value: 42 }));

    const result = await fetchWorkerData('foo', '/data/foo.json', schema);
    expect(result).toEqual({ value: 42 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toContain('/github/foo');
  });

  it('falls back to static JSON when the worker response fails the schema', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ value: 'not-a-number' })) // worker → invalid
      .mockResolvedValueOnce(jsonResponse({ value: 7 })); // static → valid

    const result = await fetchWorkerData('foo', '/data/foo.json', schema);
    expect(result).toEqual({ value: 7 });
  });

  it('falls back to static JSON when the worker errors', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(jsonResponse({ value: 9 }));

    const result = await fetchWorkerData('bar', '/data/bar.json', schema);
    expect(result).toEqual({ value: 9 });
  });

  it('returns null when both worker and static fail validation', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ value: 'bad' }))
      .mockResolvedValueOnce(jsonResponse({ value: 'also bad' }));

    const result = await fetchWorkerData('baz', '/data/baz.json', schema);
    expect(result).toBeNull();
  });

  it('deduplicates concurrent calls to the same endpoint', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ value: 1 }));

    const [a, b, c] = await Promise.all([
      fetchWorkerData('dedupe', '/data/dedupe.json', schema),
      fetchWorkerData('dedupe', '/data/dedupe.json', schema),
      fetchWorkerData('dedupe', '/data/dedupe.json', schema),
    ]);

    expect(a).toEqual({ value: 1 });
    expect(b).toEqual({ value: 1 });
    expect(c).toEqual({ value: 1 });
    // One worker call shared across all three callers
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
