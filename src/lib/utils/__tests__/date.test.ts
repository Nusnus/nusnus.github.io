import { describe, it, expect } from 'vitest';
import { formatDate, formatCompactNumber, relativeTime, MONTH_NAMES } from '@lib/utils/date';

describe('date utils', () => {
  describe('MONTH_NAMES', () => {
    it('has 12 entries', () => {
      expect(MONTH_NAMES).toHaveLength(12);
    });

    it('starts with Jan and ends with Dec', () => {
      expect(MONTH_NAMES[0]).toBe('Jan');
      expect(MONTH_NAMES[11]).toBe('Dec');
    });
  });

  describe('formatDate', () => {
    it('formats an ISO date string', () => {
      const result = formatDate('2025-06-15');
      expect(result).toMatch(/Jun/);
      expect(result).toMatch(/15/);
      expect(result).toMatch(/2025/);
    });
  });

  describe('formatCompactNumber', () => {
    it('leaves small numbers as-is', () => {
      expect(formatCompactNumber(42)).toBe('42');
      expect(formatCompactNumber(999)).toBe('999');
    });

    it('formats thousands with K suffix', () => {
      expect(formatCompactNumber(1500)).toBe('1.5K');
      expect(formatCompactNumber(25000)).toBe('25K');
    });

    it('formats millions with M suffix', () => {
      expect(formatCompactNumber(1500000)).toBe('1.5M');
    });
  });

  describe('relativeTime', () => {
    it('returns a relative string for recent dates', () => {
      const now = new Date().toISOString();
      const result = relativeTime(now);
      // Should return something like "now" or "0 seconds ago"
      expect(result).toBeTruthy();
    });

    it('returns minutes ago for dates a few minutes in the past', () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      expect(relativeTime(fiveMinAgo)).toMatch(/minute/);
    });

    it('returns hours ago for dates a few hours in the past', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      expect(relativeTime(twoHoursAgo)).toMatch(/hour/);
    });

    it('returns days ago for dates a few days in the past', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      expect(relativeTime(threeDaysAgo)).toMatch(/day/);
    });
  });
});
