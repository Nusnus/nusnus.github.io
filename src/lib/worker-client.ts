/**
 * Shared client-side worker data fetcher.
 *
 * Fetches live data from the Cloudflare Worker (edge-cached, stale-while-
 * revalidate) with automatic fallback to build-time static JSON files. All
 * responses are validated against a schema before being returned, so bad
 * data from a misbehaving worker cannot poison consumers or the localStorage
 * cache downstream.
 *
 * Concurrent calls to the same endpoint share a single network request.
 */

import { WORKER_BASE_URL } from '@config';

interface SchemaLike<T> {
  safeParse(input: unknown): { success: true; data: T } | { success: false };
}

/** Module-level cache — deduplicates concurrent fetches to the same endpoint. */
const inflightCache = new Map<string, Promise<unknown>>();

/** @internal Reset the in-flight cache. Test-only. */
export function __resetInflightCacheForTests(): void {
  inflightCache.clear();
}

/**
 * Fetch and validate data from the worker, falling back to static JSON.
 * Concurrent calls to the same endpoint share a single network request.
 *
 * Returns `null` if both sources fail or the response fails schema validation.
 */
export function fetchWorkerData<T>(
  workerPath: string,
  staticPath: string,
  schema: SchemaLike<T>,
): Promise<T | null> {
  const key = workerPath;
  if (!inflightCache.has(key)) {
    const promise = doFetch<T>(workerPath, staticPath, schema).finally(() => {
      // Clear after resolution so future calls re-fetch (data may have changed)
      inflightCache.delete(key);
    });
    inflightCache.set(key, promise);
  }
  return inflightCache.get(key) as Promise<T | null>;
}

async function tryParse<T>(res: Response, schema: SchemaLike<T>): Promise<T | null> {
  try {
    const json: unknown = await res.json();
    const parsed = schema.safeParse(json);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function doFetch<T>(
  workerPath: string,
  staticPath: string,
  schema: SchemaLike<T>,
): Promise<T | null> {
  // Try worker first (live, edge-cached)
  try {
    const res = await fetch(`${WORKER_BASE_URL}/github/${workerPath}`);
    if (res.ok) {
      const data = await tryParse(res, schema);
      if (data !== null) return data;
    }
  } catch {
    /* network error — fall through to static */
  }
  // Fallback to build-time static JSON
  try {
    const res = await fetch(staticPath);
    if (res.ok) return await tryParse(res, schema);
  } catch {
    /* ignore */
  }
  return null;
}
