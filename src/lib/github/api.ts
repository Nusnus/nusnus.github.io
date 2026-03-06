import type { GitHubEvent, GitHubProfile } from './types';
import { cache } from '../data/cache';
import { GITHUB_USERNAME } from '@config';

const BASE_URL = 'https://api.github.com';
const HEADERS = {
  Accept: 'application/vnd.github.v3+json',
};

/**
 * Fetches data from GitHub API with caching.
 * Returns null on failure (graceful degradation).
 */
async function fetchGitHub<T>(path: string, cacheKey: string): Promise<T | null> {
  const cached = cache.get<T>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(`${BASE_URL}${path}`, { headers: HEADERS });
    if (!response.ok) {
      console.warn(`GitHub API ${path}: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = (await response.json()) as T;
    cache.set(cacheKey, data);
    return data;
  } catch (error) {
    console.warn(`GitHub API ${path} failed:`, error);
    return null;
  }
}

/**
 * Fetches the user's recent public events.
 */
export async function fetchEvents(username = GITHUB_USERNAME): Promise<GitHubEvent[] | null> {
  return fetchGitHub<GitHubEvent[]>(
    `/users/${username}/events/public?per_page=30`,
    `events:${username}`,
  );
}

/**
 * Fetches the user's public profile.
 */
export async function fetchProfile(username = GITHUB_USERNAME): Promise<GitHubProfile | null> {
  return fetchGitHub<GitHubProfile>(`/users/${username}`, `profile:${username}`);
}

/**
 * Fetches open pull requests for a repository.
 */
export async function fetchOpenPRs(
  owner: string,
  repo: string,
): Promise<{ title: string; html_url: string; number: number; created_at: string }[] | null> {
  return fetchGitHub(
    `/repos/${owner}/${repo}/pulls?state=open&per_page=10`,
    `prs:${owner}/${repo}`,
  );
}
