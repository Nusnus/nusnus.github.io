/**
 * Data loader — fetches live data from the Cloudflare Worker (edge-cached),
 * falling back to static JSON files on disk when the worker is unavailable.
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

const WORKER_URL = 'https://ai-proxy.tomer-nosrati.workers.dev';
const DATA_DIR = join(process.cwd(), 'public', 'data');

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
 * Worker responses are validated with the same Zod schema.
 */
async function loadData<T>(
  workerPath: string,
  filename: string,
  schema: { parse: (data: unknown) => T },
): Promise<T | null> {
  // Try worker first (live, edge-cached)
  try {
    const res = await fetch(`${WORKER_URL}/github/${workerPath}`, {
      headers: { Origin: 'https://nusnus.github.io' },
    });
    if (res.ok) {
      const data: unknown = await res.json();
      return schema.parse(data);
    }
  } catch {
    /* network error — fall through to disk */
  }

  // Fallback to static JSON on disk
  return loadFromDisk(filename, schema);
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
