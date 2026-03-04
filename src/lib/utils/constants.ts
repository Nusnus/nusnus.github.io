/**
 * @deprecated Import from `@config` instead.
 *
 * This file re-exports from the new centralized config modules
 * for backwards compatibility during migration.
 */

export {
  GITHUB_USERNAME,
  SITE_URL,
  OPEN_COLLECTIVE_URL,
  CELERY_REPOS,
  CELERY_ORG_REPOS,
  REPO_ROLES,
  SOCIAL_LINKS,
  LINKEDIN_ARTICLES,
  COLLABORATIONS,
  isKnownPublicRepo,
  safeRepoName,
} from '@config';
