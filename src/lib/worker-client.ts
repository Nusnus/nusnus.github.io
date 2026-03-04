/**
 * Shared client-side worker data fetcher.
 *
 * Fetches live data from the Cloudflare Worker (edge-cached) with
 * automatic fallback to build-time static JSON files.
 * Deduplicates concurrent requests to the same endpoint.
 */

const WORKER_URL = 'https://ai-proxy.tomer-nosrati.workers.dev';

/** Module-level cache — deduplicates concurrent fetches to the same endpoint. */
const inflightCache = new Map<string, Promise<unknown>>();

/**
 * Fetch data from the worker, falling back to static JSON.
 * Concurrent calls to the same endpoint share a single network request.
 */
export function fetchWorkerData<T>(workerPath: string, staticPath: string): Promise<T | null> {
  const key = workerPath;
  if (!inflightCache.has(key)) {
    const promise = doFetch<T>(workerPath, staticPath).finally(() => {
      // Clear after resolution so future calls re-fetch (data may have changed)
      inflightCache.delete(key);
    });
    inflightCache.set(key, promise);
  }
  return inflightCache.get(key) as Promise<T | null>;
}

async function doFetch<T>(workerPath: string, staticPath: string): Promise<T | null> {
  // Try worker first (live, edge-cached)
  try {
    const res = await fetch(`${WORKER_URL}/github/${workerPath}`);
    if (res.ok) return (await res.json()) as T;
  } catch {
    /* network error — fall through to static */
  }
  // Fallback to build-time static JSON
  try {
    const res = await fetch(staticPath);
    if (res.ok) return (await res.json()) as T;
  } catch {
    /* ignore */
  }
  return null;
}
