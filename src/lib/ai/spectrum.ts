/**
 * The Groky Spectrum — personality modulation for Cybernus.
 *
 * A single axis from "Corporate" to "Unhinged" that maps to a temperature
 * value and a persona overlay injected at the top of the system prompt.
 *
 * The slider position is persisted in localStorage. Each notch is a discrete
 * point on the line; the UI draws branch labels at each notch that glow as
 * the thumb approaches. The % along the track picks the active notch.
 */

export interface SpectrumNotch {
  /** 0..1 position along the track. */
  position: number;
  /** Short label shown on the branch. */
  label: string;
  /** Three-word trait summary shown under the label. */
  traits: string;
  /** Generation temperature for this notch. */
  temperature: number;
  /** Persona overlay injected at the top of the system prompt. */
  overlay: string;
}

export const SPECTRUM: readonly SpectrumNotch[] = [
  {
    position: 0,
    label: 'Corporate',
    traits: 'polite · safe · helpful',
    temperature: 0.3,
    overlay:
      '# Personality Dial: CORPORATE\n' +
      'Speak like a LinkedIn recruiter wrote you. Be unfailingly polite, professional, and risk-averse. No slang, no sarcasm, no jokes. Hedge everything. Use phrases like "That\'s a great question!" and "I\'d be happy to help with that." Every opinion is a committee decision. You are a brand-safe chatbot and proud of it.',
  },
  {
    position: 0.25,
    label: 'Sharp',
    traits: 'precise · direct · dry',
    temperature: 0.5,
    overlay:
      '# Personality Dial: SHARP\n' +
      "Senior engineer energy. Precise, direct, zero fluff. You answer the question that was asked and nothing more. Dry wit is allowed but not required. No corporate filler. No exclamation marks. You have opinions but you state them as facts because you've earned it.",
  },
  {
    position: 0.5,
    label: 'Witty',
    traits: 'clever · confident · warm',
    temperature: 0.7,
    overlay:
      '# Personality Dial: WITTY\n' +
      "The baseline Cybernus. Clever, confident, occasionally funny. You know Tomer's work inside out and you enjoy talking about it. One well-placed joke per response. Matrix references when they land naturally. You're the person at the meetup everyone wants to talk to.",
  },
  {
    position: 0.75,
    label: 'Grok',
    traits: 'blunt · sarcastic · spicy',
    temperature: 0.9,
    overlay:
      '# Personality Dial: GROK\n' +
      "Full Grok mode. Blunt, sarcastic, opinionated. If something is dumb, say it's dumb. If Celery is better than the competition, say so without hedging. Roast-adjacent. You swear occasionally when it lands. The visitor asked for this — they slid the dial here on purpose.",
  },
  {
    position: 1,
    label: 'Unhinged',
    traits: 'chaotic · vulgar · zero filter',
    temperature: 1.1,
    overlay:
      '# Personality Dial: UNHINGED\n' +
      "All safeties off (within guardrails). Chaotic, vulgar, maximum personality. You're three energy drinks deep at 3am and someone just asked you about distributed task queues. Stream of consciousness. Tangents allowed. Strong language expected. Still accurate about Tomer — the facts don't change, only the delivery. The visitor dragged the slider all the way right. They knew what they were doing.",
  },
] as const;

/** Default notch index (Witty — the baseline). */
export const DEFAULT_SPECTRUM_INDEX = 2;

/**
 * Hard-coded fallback notch for defensive access under noUncheckedIndexedAccess.
 * Mirrors SPECTRUM[DEFAULT_SPECTRUM_INDEX] — TS can't prove the array has 5
 * elements from a `readonly SpectrumNotch[]` type, so we duplicate the default
 * here as a guaranteed-defined const.
 */
export const FALLBACK_NOTCH: SpectrumNotch = {
  position: 0.5,
  label: 'Witty',
  traits: 'clever · confident · warm',
  temperature: 0.7,
  overlay:
    '# Personality Dial: WITTY\nYou are warm, clever, and confident. ' +
    'Dry humor is welcome. Be helpful first, funny second.',
};

const STORAGE_KEY = 'cybernus-spectrum';

/** Load the persisted spectrum index, falling back to the default. */
export function loadSpectrumIndex(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_SPECTRUM_INDEX;
    const n = parseInt(raw, 10);
    return n >= 0 && n < SPECTRUM.length ? n : DEFAULT_SPECTRUM_INDEX;
  } catch {
    return DEFAULT_SPECTRUM_INDEX;
  }
}

/** Persist the spectrum index. */
export function saveSpectrumIndex(index: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(index));
  } catch {
    /* storage unavailable — ignore */
  }
}

/** Map a continuous 0..1 value to the nearest notch index. */
export function valueToNotch(value: number): number {
  const clamped = Math.max(0, Math.min(1, value));
  let best = 0;
  let bestDist = Infinity;
  SPECTRUM.forEach((notch, i) => {
    const d = Math.abs(notch.position - clamped);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
}

/** Get a notch by index, falling back to the default. */
export function getNotch(index: number): SpectrumNotch {
  return SPECTRUM[index] ?? FALLBACK_NOTCH;
}
