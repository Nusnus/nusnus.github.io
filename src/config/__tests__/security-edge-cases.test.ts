import { describe, it, expect } from 'vitest';
import { isKnownPublicRepo, safeRepoName } from '@config/security';

describe('security edge cases', () => {
  describe('isKnownPublicRepo - attack vectors', () => {
    it('rejects empty string', () => {
      expect(isKnownPublicRepo('')).toBe(false);
    });

    it('rejects malformed repo names', () => {
      expect(isKnownPublicRepo('no-slash')).toBe(false);
      expect(isKnownPublicRepo('/')).toBe(false);
      expect(isKnownPublicRepo('///')).toBe(false);
    });

    it('rejects path traversal attempts', () => {
      expect(isKnownPublicRepo('../celery/celery')).toBe(false);
      expect(isKnownPublicRepo('../../nusnus/repo')).toBe(false);
      expect(isKnownPublicRepo('./celery/celery')).toBe(false);
    });

    it('rejects URL injection attempts', () => {
      expect(isKnownPublicRepo('https://github.com/celery/celery')).toBe(false);
      expect(isKnownPublicRepo('http://nusnus/repo')).toBe(false);
      expect(isKnownPublicRepo('javascript:alert(1)')).toBe(false);
    });

    it('rejects unicode/homograph attacks', () => {
      // Cyrillic 'с' (U+0441) looks like Latin 'c'
      expect(isKnownPublicRepo('сelery/celery')).toBe(false);
      // Zero-width characters
      expect(isKnownPublicRepo('celery\u200B/celery')).toBe(false);
    });

    it('rejects case variations of unknown repos', () => {
      expect(isKnownPublicRepo('UNKNOWN/repo')).toBe(false);
      expect(isKnownPublicRepo('Unknown/Repo')).toBe(false);
      expect(isKnownPublicRepo('unknown/REPO')).toBe(false);
    });

    it('handles multiple slashes', () => {
      expect(isKnownPublicRepo('celery/celery/extra')).toBe(false);
      expect(isKnownPublicRepo('nusnus/repo/path')).toBe(false);
    });

    it('rejects whitespace variations', () => {
      expect(isKnownPublicRepo(' celery/celery')).toBe(false);
      expect(isKnownPublicRepo('celery /celery')).toBe(false);
      expect(isKnownPublicRepo('celery/ celery')).toBe(false);
      expect(isKnownPublicRepo('celery/celery ')).toBe(false);
    });

    it('rejects special characters in owner', () => {
      expect(isKnownPublicRepo('celery@/repo')).toBe(false);
      expect(isKnownPublicRepo('celery#/repo')).toBe(false);
      expect(isKnownPublicRepo('celery$/repo')).toBe(false);
    });
  });

  describe('safeRepoName - redaction behavior', () => {
    it('redacts all unknown repos consistently', () => {
      expect(safeRepoName('private-org/secret-repo')).toBe('Private Project');
      expect(safeRepoName('company/internal-tool')).toBe('Private Project');
      expect(safeRepoName('user/personal-project')).toBe('Private Project');
    });

    it('preserves known public repos exactly', () => {
      expect(safeRepoName('celery/celery')).toBe('celery/celery');
      expect(safeRepoName('Nusnus/public-repo')).toBe('Nusnus/public-repo');
      expect(safeRepoName('mher/flower')).toBe('mher/flower');
    });

    it('redacts malformed inputs', () => {
      expect(safeRepoName('')).toBe('Private Project');
      expect(safeRepoName('no-slash')).toBe('Private Project');
      expect(safeRepoName('/')).toBe('Private Project');
    });

    it('redacts path traversal attempts', () => {
      expect(safeRepoName('../private/repo')).toBe('Private Project');
      expect(safeRepoName('../../secret/data')).toBe('Private Project');
    });

    it('redacts URL injection attempts', () => {
      expect(safeRepoName('https://evil.com/repo')).toBe('Private Project');
      expect(safeRepoName('javascript:alert(1)')).toBe('Private Project');
    });

    it('handles case sensitivity correctly', () => {
      // Known owners are case-insensitive
      expect(safeRepoName('CELERY/celery')).toBe('CELERY/celery');
      expect(safeRepoName('Celery/Celery')).toBe('Celery/Celery');
      expect(safeRepoName('NUSNUS/repo')).toBe('NUSNUS/repo');
      expect(safeRepoName('MHER/flower')).toBe('MHER/flower');
    });
  });

  describe('known public owners allowlist', () => {
    it('accepts all known owners (case-insensitive)', () => {
      const knownOwners = ['nusnus', 'celery', 'mher'];
      const caseVariations = [
        (s: string) => s.toLowerCase(),
        (s: string) => s.toUpperCase(),
        (s: string) => s.charAt(0).toUpperCase() + s.slice(1),
      ];

      for (const owner of knownOwners) {
        for (const transform of caseVariations) {
          const repoName = `${transform(owner)}/test-repo`;
          expect(isKnownPublicRepo(repoName)).toBe(true);
          expect(safeRepoName(repoName)).toBe(repoName);
        }
      }
    });

    it('rejects similar-looking but different owners', () => {
      expect(isKnownPublicRepo('nusnus1/repo')).toBe(false);
      expect(isKnownPublicRepo('celery-org/repo')).toBe(false);
      expect(isKnownPublicRepo('mher1/repo')).toBe(false);
      expect(isKnownPublicRepo('nusnus_/repo')).toBe(false);
    });
  });

  describe('data leak prevention', () => {
    it('never leaks private repo names in any form', () => {
      const privateRepos = [
        'company/secret-api',
        'org/internal-tool',
        'user/private-project',
        'client/confidential',
      ];

      for (const repo of privateRepos) {
        const safe = safeRepoName(repo);
        expect(safe).toBe('Private Project');
        expect(safe).not.toContain(repo);
        expect(safe).not.toContain(repo.split('/')[0]);
        expect(safe).not.toContain(repo.split('/')[1]);
      }
    });

    it('redaction is consistent across multiple calls', () => {
      const privateRepo = 'secret-org/secret-repo';
      const results = Array.from({ length: 10 }, () => safeRepoName(privateRepo));
      expect(new Set(results).size).toBe(1);
      expect(results[0]).toBe('Private Project');
    });
  });
});
