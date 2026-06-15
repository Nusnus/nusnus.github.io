/**
 * Site-wide configuration constants.
 *
 * Single source of truth for URLs, usernames, and global settings.
 * Imported by both client and server code.
 */

export { GITHUB_USERNAME } from '../../shared/github-config';
export const SITE_URL = 'https://nusnus.github.io';
export const OPEN_COLLECTIVE_URL = 'https://opencollective.com/celery';

/**
 * Cloudflare Worker base URL.
 *
 * Serves live, edge-cached GitHub data with a stale-while-revalidate policy:
 *   - GET /github/profile|repos|org-repos|activity|contributions
 */
export const WORKER_BASE_URL = 'https://ai-proxy.tomer-nosrati.workers.dev';
