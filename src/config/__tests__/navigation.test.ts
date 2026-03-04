import { describe, it, expect } from 'vitest';
import { NAV_LINKS } from '@config/navigation';

describe('navigation config', () => {
  it('exports a non-empty array of nav links', () => {
    expect(NAV_LINKS.length).toBeGreaterThan(0);
  });

  it('every link has href and label', () => {
    for (const link of NAV_LINKS) {
      expect(link.href).toBeTruthy();
      expect(link.label).toBeTruthy();
    }
  });

  it('all hrefs start with #', () => {
    for (const link of NAV_LINKS) {
      expect(link.href).toMatch(/^#/);
    }
  });
});
