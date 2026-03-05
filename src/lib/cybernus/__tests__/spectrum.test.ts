/**
 * Tests for `src/lib/cybernus/spectrum.ts` — the Groky Spectrum slider logic.
 *
 * Pure functions over a const literal. The interesting cases are all
 * boundary conditions: does `bandForValue(25)` land in Professional (max=25)
 * or Conversational (min=25)? The contract says `max` is EXCLUSIVE except
 * for the last band's 100 — these tests lock that in.
 *
 * 4-band design (0-25-50-75-100): Professional → Conversational → Witty → Unhinged.
 */

import { describe, it, expect } from 'vitest';
import {
  SPECTRUM_BANDS,
  DEFAULT_SPECTRUM,
  bandForValue,
  buildSpectrumPrompt,
} from '@lib/cybernus/spectrum';

describe('SPECTRUM_BANDS', () => {
  it('has exactly four bands', () => {
    expect(SPECTRUM_BANDS).toHaveLength(4);
  });

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

  it('has a non-empty behavioural instruction per band', () => {
    // `instruction` is what goes in the prompt; `blurb` is UI-only.
    for (const b of SPECTRUM_BANDS) {
      expect(b.instruction.length).toBeGreaterThan(20);
      expect(b.instruction).not.toBe(b.blurb);
    }
  });
});

describe('DEFAULT_SPECTRUM', () => {
  it('is 50 and lands in the Witty band (the documented default)', () => {
    expect(DEFAULT_SPECTRUM).toBe(50);
    expect(bandForValue(DEFAULT_SPECTRUM).label).toBe('Witty');
  });
});

describe('bandForValue', () => {
  it('resolves the middle of each band', () => {
    expect(bandForValue(12).label).toBe('Professional');
    expect(bandForValue(37).label).toBe('Conversational');
    expect(bandForValue(62).label).toBe('Witty');
    expect(bandForValue(87).label).toBe('Unhinged');
  });

  it('treats max as exclusive (25 → Conversational, not Professional)', () => {
    // min=25 for Conversational, max=25 for Professional. The >= / < test
    // means the boundary value belongs to the UPPER band.
    expect(bandForValue(25).label).toBe('Conversational');
    expect(bandForValue(50).label).toBe('Witty');
    expect(bandForValue(75).label).toBe('Unhinged');
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

  it('includes the band instruction (not just the UI blurb)', () => {
    const out = buildSpectrumPrompt(10);
    expect(out).toContain('**Instruction:**');
    expect(out).toContain('recruiter-safe'); // from Professional's instruction
  });

  it('Unhinged explicitly permits profanity', () => {
    // Spec: "At 100 the tone should be noticeably different — profanity OK."
    const out = buildSpectrumPrompt(100);
    expect(out.toLowerCase()).toContain('profanity');
  });

  it('ends with the invariant reminder (facts never change)', () => {
    const out = buildSpectrumPrompt(50);
    expect(out).toContain('facts never change');
  });

  it('produces different output for different bands', () => {
    expect(buildSpectrumPrompt(10)).not.toBe(buildSpectrumPrompt(90));
  });
});
