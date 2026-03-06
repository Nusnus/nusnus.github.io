/**
 * Shared GitHub configuration — single source of truth.
 *
 * Imported by both the site (`src/config/`) and the Cloudflare Worker (`worker/src/`).
 * Keep this file free of framework-specific imports (no Astro, no React).
 */

export const GITHUB_USERNAME = 'Nusnus';

/** Featured repos (Celery core projects). */
export const CELERY_REPOS = ['celery/celery', 'celery/pytest-celery', 'celery/kombu'] as const;

/** Additional Celery organization repos. */
export const CELERY_ORG_REPOS = [
  'celery/billiard',
  'celery/django-celery-beat',
  'celery/django-celery-results',
  'celery/py-amqp',
  'celery/librabbitmq',
  'celery/vine',
  'celery/sphinx_celery',
  'celery/celeryproject',
  'mher/flower',
] as const;

export type RepoRole = 'owner' | 'lead' | 'creator' | 'contributor';

/** Role assignments for each repo. */
export const REPO_ROLES: Record<string, RepoRole> = {
  'celery/celery': 'owner',
  'celery/pytest-celery': 'creator',
  'celery/kombu': 'owner',
  'celery/billiard': 'owner',
  'celery/django-celery-beat': 'owner',
  'celery/django-celery-results': 'owner',
  'celery/py-amqp': 'owner',
  'celery/librabbitmq': 'owner',
  'celery/vine': 'owner',
  'celery/sphinx_celery': 'owner',
  'celery/celeryproject': 'owner',
  'mher/flower': 'contributor',
};

/** Known public repo owners — defense-in-depth filter for activity events. */
const KNOWN_PUBLIC_OWNERS: ReadonlySet<string> = new Set(['nusnus', 'celery', 'mher']);

/** Check if a repo full name (owner/repo) belongs to a known public owner. */
export function isKnownPublicRepo(repoFullName: string): boolean {
  // Security: Validate format is exactly "owner/repo" (one slash, no whitespace)
  const parts = repoFullName.split('/');
  if (parts.length !== 2) return false;

  const owner = parts[0]?.toLowerCase().trim() ?? '';
  const repo = parts[1]?.trim() ?? '';

  // Reject if owner or repo is empty, or if trimming changed the value (had whitespace)
  if (!owner || !repo || owner !== parts[0]?.toLowerCase() || repo !== parts[1]) {
    return false;
  }

  return KNOWN_PUBLIC_OWNERS.has(owner);
}

/** Redact a repo name if it's not from a known public owner. */
export function safeRepoName(repoFullName: string): string {
  return isKnownPublicRepo(repoFullName) ? repoFullName : 'Private Project';
}
