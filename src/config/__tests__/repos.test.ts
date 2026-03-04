import { describe, it, expect } from 'vitest';
import {
  CELERY_REPOS,
  CELERY_ORG_REPOS,
  REPO_ROLES,
  ROLE_BADGE_VARIANT,
  ROLE_LABEL,
} from '@config/repos';

describe('repos config', () => {
  it('CELERY_REPOS is non-empty', () => {
    expect(CELERY_REPOS.length).toBeGreaterThan(0);
  });

  it('CELERY_ORG_REPOS is non-empty', () => {
    expect(CELERY_ORG_REPOS.length).toBeGreaterThan(0);
  });

  it('every repo in CELERY_REPOS has a role defined', () => {
    for (const repo of CELERY_REPOS) {
      expect(REPO_ROLES).toHaveProperty(repo);
    }
  });

  it('every repo in CELERY_ORG_REPOS has a role defined', () => {
    for (const repo of CELERY_ORG_REPOS) {
      expect(REPO_ROLES).toHaveProperty(repo);
    }
  });

  it('every role has a badge variant', () => {
    const roles = new Set(Object.values(REPO_ROLES));
    for (const role of roles) {
      expect(ROLE_BADGE_VARIANT).toHaveProperty(role);
    }
  });

  it('every role has a label', () => {
    const roles = new Set(Object.values(REPO_ROLES));
    for (const role of roles) {
      expect(ROLE_LABEL).toHaveProperty(role);
    }
  });
});
