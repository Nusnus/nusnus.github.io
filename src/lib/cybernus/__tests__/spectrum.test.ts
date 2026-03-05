/**
 * Tests for `src/lib/cybernus/spectrum.ts` — the Groky Spectrum slider logic.
 *
 * Pure functions over a const literal. The interesting cases are all
 * boundary conditions: does `bandForValue(20)` land in Professional (max=20)
 * or Conversational (min=20)? The contract says `max` is EXCLUSIVE except
 * for the last band's 100 — these tests lock that in.
 */

import { describe, it, expect } from 'vitest';
import {
  SPECTRUM_BANDS,
  DEFAULT_SPECTRUM,
  bandForValue,
  buildSpectrumPrompt,
} from '@lib/cybernus/spectrum';

describe('SPECTRUM_BANDS', () => {
  it('covers 0-100 contiguously with no gaps', () => {
    const sorted = [...SPECTRUM_BANDS].sort((a, b) => a.min - b.min);
    expect(sorted[0]?.min).toBe(0);
    expect(sorted[sorted.length - 1]?.max).toBe(100);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i]?.min).toBe(sorted[i - 1]?.max);
    }
  });

  it('has unique labels', () => {
    const labels = SPECTRUM_BANDS.map((b) => b.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('has valid oklch glow colours', () => {
    for (const b of SPECTRUM_BANDS) {
      expect(b.glow).toMatch(/^oklch\([\d.]+ [\d.]+ \d+\)$/);
    }
  });
});

describe('DEFAULT_SPECTRUM', () => {
  it('lands in the Witty band (the documented default)', () => {
    expect(bandForValue(DEFAULT_SPECTRUM).label).toBe('Witty');
  });
});

describe('bandForValue', () => {
  it('resolves the middle of each band', () => {
    expect(bandForValue(10).label).toBe('Professional');
    expect(bandForValue(30).label).toBe('Conversational');
    expect(bandForValue(50).label).toBe('Witty');
    expect(bandForValue(70).label).toBe('Spicy');
    expect(bandForValue(90).label).toBe('Unhinged');
  });

  it('treats max as exclusive (20 → Conversational, not Professional)', () => {
    // min=20 for Conversational, max=20 for Professional. The >= / < test
    // means the boundary value belongs to the UPPER band.
    expect(bandForValue(20).label).toBe('Conversational');
    expect(bandForValue(40).label).toBe('Witty');
    expect(bandForValue(60).label).toBe('Spicy');
    expect(bandForValue(80).label).toBe('Unhinged');
  });

  it('handles 0 and 100 (inclusive endpoints)', () => {
    expect(bandForValue(0).label).toBe('Professional');
    // 100 is the one inclusive max — the find() misses (100 < 100 is false)
    // and the ?? fallback picks the last band.
    expect(bandForValue(100).label).toBe('Unhinged');
  });

  it('clamps out-of-range inputs', () => {
    expect(bandForValue(-50).label).toBe('Professional');
    expect(bandForValue(150).label).toBe('Unhinged');
    expect(bandForValue(NaN).label).toBe('Unhinged'); // NaN clamps to NaN → find() misses → fallback
  });
});

describe('buildSpectrumPrompt', () => {
  it('includes the rounded percentage and band label', () => {
    const out = buildSpectrumPrompt(94.7);
    expect(out).toContain('**95%**');
    expect(out).toContain('**Unhinged**');
    expect(out).toContain('## Current Spectrum Setting');
  });

  it('includes the band blurb', () => {
    const out = buildSpectrumPrompt(10);
    expect(out).toContain('LinkedIn-clean');
  });

  it('ends with the invariant reminder (facts never change)', () => {
    const out = buildSpectrumPrompt(50);
    expect(out).toContain('facts never change');
  });

  it('produces different output for different bands', () => {
    expect(buildSpectrumPrompt(10)).not.toBe(buildSpectrumPrompt(90));
  });
});
