/**
 * Repository configuration.
 *
 * Re-exports shared config and adds site-specific display mappings.
 */

import type { RepoRole } from '../../shared/github-config';

export {
  CELERY_REPOS,
  CELERY_ORG_REPOS,
  REPO_ROLES,
  type RepoRole,
} from '../../shared/github-config';

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
