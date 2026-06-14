import { describe, it, expect } from 'vitest';
import { GITHUB_USERNAME, SITE_URL, WORKER_BASE_URL, OPEN_COLLECTIVE_URL } from '@config/site';

describe('site config', () => {
  it('exports correct GitHub username', () => {
    expect(GITHUB_USERNAME).toBe('Nusnus');
  });

  it('exports valid SITE_URL', () => {
    expect(SITE_URL).toMatch(/^https:\/\//);
  });

  it('exports a valid WORKER_BASE_URL', () => {
    expect(WORKER_BASE_URL).toMatch(/^https:\/\//);
  });

  it('exports valid OPEN_COLLECTIVE_URL', () => {
    expect(OPEN_COLLECTIVE_URL).toMatch(/^https:\/\/opencollective\.com/);
  });
});
