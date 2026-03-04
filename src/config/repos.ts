/**
 * Repository configuration.
 *
 * Single source of truth for repo lists, roles, and role display config.
 * Used by the site, build scripts, and (via copy) the Cloudflare Worker.
 */

export type RepoRole = 'owner' | 'lead' | 'creator' | 'contributor';

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

/** Badge variant for each role. */
export const ROLE_BADGE_VARIANT: Record<RepoRole, 'accent' | 'filled' | 'ghost'> = {
  owner: 'accent',
  creator: 'accent',
  lead: 'filled',
  contributor: 'ghost',
};

/** Human-readable label for each role. */
export const ROLE_LABEL: Record<RepoRole, string> = {
  owner: 'Owner',
  creator: 'Creator',
  lead: 'Lead',
  contributor: 'Contributor',
};
