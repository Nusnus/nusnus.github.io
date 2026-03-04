/**
 * Data loader — fetches live data from the Cloudflare Worker (edge-cached),
 * falling back to static JSON files on disk when the worker is unavailable.
 *
 * Features:
 * - In-memory cache with TTL — avoids redundant network requests across
 *   components that load the same data during a single Astro render pass.
 * - Inflight deduplication — concurrent calls to the same endpoint share
 *   a single network request.
 *
 * All public functions are async. Astro frontmatter supports top-level await.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  profileSchema,
  reposSchema,
  activitySchema,
  contributionGraphSchema,
  metaSchema,
} from '../github/schemas';
import type {
  ProfileData,
  RepoData,
  ActivityData,
  ContributionGraphData,
  MetaData,
} from '../github/types';

import { WORKER_BASE_URL } from '@config';

const WORKER_URL = WORKER_BASE_URL;
const DATA_DIR = join(process.cwd(), 'public', 'data');

/* ── In-memory cache ── */
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

/** TTL for cached data — 60 s keeps dev snappy while staying reasonably fresh. */
const CACHE_TTL_MS = 60_000;

const memoryCache = new Map<string, CacheEntry<unknown>>();
const inflightRequests = new Map<string, Promise<unknown>>();

/**
 * Reads and validates a JSON data file from disk.
 * Returns null if the file is missing or invalid.
 */
function loadFromDisk<T>(filename: string, schema: { parse: (data: unknown) => T }): T | null {
  try {
    const raw = readFileSync(join(DATA_DIR, filename), 'utf-8');
    const data: unknown = JSON.parse(raw);
    return schema.parse(data);
  } catch {
    return null;
  }
}

/**
 * Fetches data from the worker, falling back to static JSON on disk.
 * Results are cached in memory and concurrent requests are deduplicated.
 */
async function loadData<T>(
  workerPath: string,
  filename: string,
  schema: { parse: (data: unknown) => T },
): Promise<T | null> {
  const cacheKey = workerPath;

  // 1. Check in-memory cache
  const cached = memoryCache.get(cacheKey) as CacheEntry<T> | undefined;
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  // 2. Deduplicate concurrent inflight requests
  if (inflightRequests.has(cacheKey)) {
    return inflightRequests.get(cacheKey) as Promise<T | null>;
  }

  const promise = (async (): Promise<T | null> => {
    // Try worker first (live, edge-cached)
    try {
      const res = await fetch(`${WORKER_URL}/github/${workerPath}`, {
        headers: { Origin: 'https://nusnus.github.io' },
      });
      if (res.ok) {
        const data: unknown = await res.json();
        const parsed = schema.parse(data);
        memoryCache.set(cacheKey, { data: parsed, expiresAt: Date.now() + CACHE_TTL_MS });
        return parsed;
      }
    } catch {
      /* network error — fall through to disk */
    }

    // Fallback to static JSON on disk
    const diskData = loadFromDisk(filename, schema);
    if (diskData) {
      memoryCache.set(cacheKey, { data: diskData, expiresAt: Date.now() + CACHE_TTL_MS });
    }
    return diskData;
  })();

  inflightRequests.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    inflightRequests.delete(cacheKey);
  }
}

export function loadProfile(): Promise<ProfileData | null> {
  return loadData('profile', 'profile.json', profileSchema);
}

export function loadRepos(): Promise<RepoData[] | null> {
  return loadData('repos', 'repos.json', reposSchema);
}

export function loadCeleryOrgRepos(): Promise<RepoData[] | null> {
  return loadData('org-repos', 'celery-org-repos.json', reposSchema);
}

export function loadActivity(): Promise<ActivityData | null> {
  return loadData('activity', 'activity.json', activitySchema);
}

export function loadContributionGraph(): Promise<ContributionGraphData | null> {
  return loadData('contributions', 'contribution-graph.json', contributionGraphSchema);
}

export function loadMeta(): Promise<MetaData | null> {
  return loadData('meta', 'meta.json', metaSchema);
}
