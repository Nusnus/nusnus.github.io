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
 * All worker endpoints are relative to this base:
 *   - GET  /github/profile|repos|org-repos|activity|contributions
 *   - POST /v1/responses (AI proxy)
 */
export const WORKER_BASE_URL = 'https://ai-proxy.tomer-nosrati.workers.dev';
export const WORKER_AI_URL = `${WORKER_BASE_URL}/v1/responses`;
