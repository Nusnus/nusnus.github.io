/**
 * Cybernus context builder — wraps the generic cloud context with
 * environment-specific signals: Groky Spectrum, language, and
 * runtime awareness (chat page vs roast widget).
 *
 * The base `buildCloudContext()` stays untouched so RoastWidget
 * continues to work without modification.
 */

import { buildCloudContext } from './cloud-context';
import { GROKY_SPECTRUM, type SpectrumLevel, type ChatLanguage } from './config';

/** Runtime signals injected into the Cybernus system prompt. */
export interface CybernusRuntime {
  /** Groky Spectrum position (0–4). Controls tone/vulgarity. */
  spectrum: SpectrumLevel;
  /** Response language. */
  language: ChatLanguage;
  /** True when the conversation was seeded by the roast widget handoff. */
  fromRoast?: boolean;
}

/**
 * Build the full Cybernus system prompt.
 *
 * Composition:
 *   1. Base cloud context (persona.md + knowledge.md + all live GitHub data)
 *   2. Runtime awareness section (where am I, what can the visitor see)
 *   3. Groky Spectrum calibration (exact label + prompt fragment)
 *   4. Response language directive
 *
 * Total ~15K tokens — trivial for Grok's 2M context.
 */
export async function buildCybernusContext(runtime: CybernusRuntime): Promise<string> {
  const spectrumConfig = GROKY_SPECTRUM[runtime.spectrum];

  const runtimeSection = [
    '# RUNTIME ENVIRONMENT — YOU ARE ON THE CHAT PAGE',
    '',
    'You are running on `/chat` — the full Cybernus construct. The visitor can see:',
    '- Matrix rain falling behind this conversation',
    `- The Groky Spectrum slider, currently set to **${spectrumConfig.label}**`,
    '- Model metadata in the header (Grok 4.1 Fast · reasoning enabled · 2M context)',
    '- A chat history panel they can open',
    '- Your reasoning trace — they can watch you think before you answer',
    '',
    runtime.fromRoast
      ? 'This conversation was **handed off from the roast widget** on the homepage. They clicked "Continue in Chat" after you roasted them. Carry the energy.'
      : 'Fresh conversation. They came here on purpose.',
    '',
    '# GROKY SPECTRUM — CURRENT CALIBRATION',
    '',
    `**GROKY SPECTRUM: ${spectrumConfig.label}** (temperature ${spectrumConfig.temperature})`,
    '',
    spectrumConfig.prompt,
    '',
    '# RESPONSE LANGUAGE',
    '',
    `**RESPONSE LANGUAGE: ${runtime.language}**`,
    '',
    runtime.language === 'es'
      ? 'Respond in **Spanish — Cali casual.** Latin American, Colombia/Cali flavor. Warm, relaxed, uses *vos* and *parce* naturally. Not textbook Spanish — street-smart Spanish. Keep ALL the personality rules above, just switch the language.'
      : 'Respond in **English.** All personality rules above apply directly.',
  ].join('\n');

  // Base context already includes persona.md, knowledge.md, and all live data.
  // We append the runtime section as `additionalContext`.
  return buildCloudContext(runtimeSection);
}
