import { describe, it, expect } from 'vitest';
import { isKnownPublicRepo, safeRepoName } from '@config/security';

describe('security config', () => {
  it('recognizes known public repos', () => {
    expect(isKnownPublicRepo('celery/celery')).toBe(true);
    expect(isKnownPublicRepo('Nusnus/some-repo')).toBe(true);
    expect(isKnownPublicRepo('mher/flower')).toBe(true);
  });

  it('rejects unknown repos', () => {
    expect(isKnownPublicRepo('unknown/repo')).toBe(false);
    expect(isKnownPublicRepo('privateOrg/secret')).toBe(false);
  });

  it('is case-insensitive on owner', () => {
    expect(isKnownPublicRepo('Celery/celery')).toBe(true);
    expect(isKnownPublicRepo('NUSNUS/repo')).toBe(true);
  });

  it('safeRepoName returns full name for known repos', () => {
    expect(safeRepoName('celery/celery')).toBe('celery/celery');
  });

  it('safeRepoName redacts unknown repos', () => {
    expect(safeRepoName('private/secret')).toBe('Private Project');
  });
});
