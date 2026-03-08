/**
 * The Groky Spectrum — personality slider configuration.
 *
 * A 0–100% continuum controlling how much edge Cybernus speaks with.
 * Left = LinkedIn-safe keynote voice. Right = full Grok chaos.
 *
 * The slider UI reads `SPECTRUM_BANDS` to render branch labels along the
 * track. `buildSpectrumPrompt()` injects the current position into the
 * system prompt so the model adjusts its delivery accordingly.
 *
 * Band boundaries match the table in `public/data/ai-context/persona.md` —
 * change both or neither.
 */

/** A single region on the Groky Spectrum. */
export interface SpectrumBand {
  /** Inclusive lower bound (0-100). */
  min: number;
  /** Exclusive upper bound (0-100). 100 is the only inclusive max. */
  max: number;
  /** Short label shown on the slider branch. */
  label: string;
  /** One-line summary of the delivery style. */
  blurb: string;
  /**
   * Accent colour for the active branch glow and thumb.
   * Walks from safe grey-green → accent green → amber → red as you go right.
   */
  glow: string;
}

/** All bands, left to right. MUST stay sorted by `min`. */
export const SPECTRUM_BANDS: readonly SpectrumBand[] = [
  {
    min: 0,
    max: 20,
    label: 'Professional',
    blurb: 'LinkedIn-clean. Polished. Recruiter-safe. Keynote voice.',
    glow: 'oklch(0.7 0.05 160)',
  },
  {
    min: 20,
    max: 40,
    label: 'Conversational',
    blurb: 'Tech-meetup energy. Friendly, direct, light dry humour.',
    glow: 'oklch(0.72 0.12 150)',
  },
  {
    min: 40,
    max: 60,
    label: 'Witty',
    blurb: 'Sharp takes. Dry wit. Smirk implied. How I actually talk.',
    glow: 'oklch(0.72 0.17 145)', // site accent — default band gets the brand colour
  },
  {
    min: 60,
    max: 80,
    label: 'Spicy',
    blurb: 'Unfiltered opinions. Mild profanity. Zero corporate softening.',
    glow: 'oklch(0.75 0.17 75)',
  },
  {
    min: 80,
    max: 100,
    label: 'Unhinged',
    blurb: 'Full Grok. Vulgar, savage, roast-adjacent. Maximum chaos.',
    glow: 'oklch(0.68 0.22 28)',
  },
];

/** Default slider position — centre of the "Witty" band. */
export const DEFAULT_SPECTRUM = 50;

/** localStorage key for persisting the spectrum position across sessions. */
export const SPECTRUM_STORAGE_KEY = 'cybernus-spectrum';

/**
 * Resolve a 0–100 position to its band.
 * Falls back to the default band if given a nonsense value.
 */
export function bandForValue(value: number): SpectrumBand {
  const clamped = Math.max(0, Math.min(100, value));
  // 100 is max-inclusive on the last band only
  const band =
    SPECTRUM_BANDS.find((b) => clamped >= b.min && clamped < b.max) ??
    SPECTRUM_BANDS[SPECTRUM_BANDS.length - 1];
  // SPECTRUM_BANDS is a non-empty const literal — this is safe, but TS
  // strictest wants the assertion for noUncheckedIndexedAccess.
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return band!;
}

/**
 * Build the `## Current Spectrum Setting` block that gets injected into
 * the system prompt. The persona already documents what each band means,
 * so this block just tells the model where the slider is right now.
 */
export function buildSpectrumPrompt(value: number): string {
  const band = bandForValue(value);
  const rounded = Math.round(value);
  return [
    '## Current Spectrum Setting',
    '',
    `Slider position: **${rounded}%** → **${band.label}**`,
    '',
    `Delivery: ${band.blurb}`,
    '',
    'Adjust your tone, vocabulary, and willingness to swear accordingly. The facts never change — only the delivery.',
  ].join('\n');
}
