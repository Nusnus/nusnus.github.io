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

const DATA_DIR = join(process.cwd(), 'public', 'data');

/**
 * Reads and validates a JSON data file at build time.
 * Returns null with a warning if the file is missing or invalid.
 */
function loadJsonFile<T>(filename: string, schema: { parse: (data: unknown) => T }): T | null {
  try {
    const raw = readFileSync(join(DATA_DIR, filename), 'utf-8');
    const data: unknown = JSON.parse(raw);
    return schema.parse(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[data-loader] Failed to load ${filename}: ${message}`);
    return null;
  }
}

export function loadProfile(): ProfileData | null {
  return loadJsonFile('profile.json', profileSchema);
}

export function loadRepos(): RepoData[] | null {
  return loadJsonFile('repos.json', reposSchema);
}

export function loadActivity(): ActivityData | null {
  return loadJsonFile('activity.json', activitySchema);
}

export function loadContributionGraph(): ContributionGraphData | null {
  return loadJsonFile('contribution-graph.json', contributionGraphSchema);
}

export function loadMeta(): MetaData | null {
  return loadJsonFile('meta.json', metaSchema);
}
