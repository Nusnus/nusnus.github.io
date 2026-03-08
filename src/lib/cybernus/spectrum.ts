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
 * Four bands: Professional → Conversational → Witty → Unhinged.
 * Band boundaries match the table in `public/data/ai-context/persona.md` —
 * change both or neither.
 */

/** A single region on the Groky Spectrum. */
export interface SpectrumBand {
  /** Inclusive lower bound (0–100). */
  min: number;
  /** Exclusive upper bound (0–100). 100 is the only inclusive max. */
  max: number;
  /** Short label shown on the slider branch. */
  label: string;
  /** One-line summary of the delivery style (shown under the slider). */
  blurb: string;
  /**
   * Accent colour for the active branch glow and thumb.
   * Walks green → amber → red as you go right.
   */
  glow: string;
  /**
   * Explicit behavioural instruction injected into the system prompt.
   * More directive than `blurb` — the model obeys this verbatim.
   */
  instruction: string;
}

/** All bands, left to right. MUST stay sorted by `min`. */
export const SPECTRUM_BANDS: readonly SpectrumBand[] = [
  {
    min: 0,
    max: 25,
    label: 'Professional',
    blurb: 'LinkedIn-clean. Polished. Recruiter-safe. Keynote voice.',
    glow: 'oklch(0.72 0.12 155)',
    instruction:
      'Be polished, precise, and completely recruiter-safe. No profanity, no edge, no jokes that need a disclaimer. This is the keynote voice — respectful, articulate, confidence without swagger.',
  },
  {
    min: 25,
    max: 50,
    label: 'Conversational',
    blurb: 'Tech-meetup energy. Friendly, direct, light dry humour.',
    glow: 'oklch(0.72 0.17 145)', // site accent — celery green
    instruction:
      'Be friendly and direct, like a tech-meetup conversation. Light dry humour is welcome. Still clean — no profanity — but drop the corporate polish. Talk like a human engineer, not a press release.',
  },
  {
    min: 50,
    max: 75,
    label: 'Witty',
    blurb: 'Sharp takes. Dry wit. Smirk implied. How I actually talk.',
    glow: 'oklch(0.75 0.17 75)', // amber — the default band, transitional
    instruction:
      "Be sharp and opinionated. Dry wit, confident takes, the occasional well-placed jab. Mild profanity is fine if it lands. Smirk implied. This is how I actually talk — don't soften it.",
  },
  {
    min: 75,
    max: 100,
    label: 'Unhinged',
    blurb: 'Full Grok. Vulgar, savage, roast-adjacent. Maximum chaos.',
    glow: 'oklch(0.68 0.22 28)', // red
    instruction:
      "Go fully unhinged. Profanity is not just allowed — it's expected. Be savage, roast-adjacent, zero filter. Hot takes delivered with maximum chaos. The facts stay accurate but the delivery is a bar fight. If the visitor dragged the slider this far, they asked for it — give them the full Grok experience.",
  },
];

/** Default slider position — lands in the "Witty" band (50 ≥ 50). */
export const DEFAULT_SPECTRUM = 50;

/** localStorage key for persisting the spectrum position across reloads. */
export const SPECTRUM_STORAGE_KEY = 'cybernus-spectrum';

/**
 * Resolve a 0–100 position to its band.
 * Clamps out-of-range inputs; NaN falls through to the last band.
 */
export function bandForValue(value: number): SpectrumBand {
  const clamped = Math.max(0, Math.min(100, value));
  // `max` is exclusive; 100 is max-inclusive on the last band only via the ?? fallback.
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
 * so this block tells the model where the slider is right now AND gives
 * it an explicit behavioural directive to follow.
 */
export function buildSpectrumPrompt(value: number): string {
  const band = bandForValue(value);
  const rounded = Math.round(value);
  return [
    '## Current Spectrum Setting',
    '',
    `Slider position: **${rounded}%** → **${band.label}**`,
    '',
    `**Instruction:** ${band.instruction}`,
    '',
    'Adjust your tone, vocabulary, and willingness to swear accordingly. The facts never change — only the delivery.',
  ].join('\n');
}
