/**
 * Cybernus — AI Configuration
 *
 * Single-model, single-provider config for Tomer's digital self.
 * No model picker. No WebLLM. Just Grok 4.1 Fast with reasoning, always.
 *
 * Backward-compat: RoastWidget imports DEFAULT_CLOUD_MODEL_ID and
 * CLOUD_GENERATION_CONFIG from here — those exports are preserved.
 */

/* ─── Cloudflare Worker proxy ─── */

/** Re-exported for cloud.ts — API key lives server-side. */
export { WORKER_AI_URL as CLOUD_PROXY_URL } from '@config';

/* ─── Model — one model, the strongest ─── */

/**
 * Grok 4.1 Fast with reasoning enabled.
 * Chain-of-thought thinking, 2M token context, strongest available.
 *
 * Used by both CybernusChat and RoastWidget (via DEFAULT_CLOUD_MODEL_ID).
 */
export const CYBERNUS_MODEL_ID = 'grok-4-1-fast-reasoning';

/**
 * Backward-compat alias — RoastWidget imports this name.
 * Keep in sync with CYBERNUS_MODEL_ID.
 */
export const DEFAULT_CLOUD_MODEL_ID = CYBERNUS_MODEL_ID;

/** Model metadata displayed in the CybernusHeader. */
export const CYBERNUS_MODEL_META = {
  id: CYBERNUS_MODEL_ID,
  displayName: 'Grok 4.1 Fast',
  provider: 'xAI',
  contextWindow: '2M tokens',
  reasoning: true,
  features: ['Reasoning', 'Web Search', 'Function Calling', '2M Context'],
} as const;

/* ─── Generation parameters ─── */

/**
 * Base generation config. Spread into every request.
 *
 * max_output_tokens is bumped to 2048 — reasoning models spend tokens
 * on chain-of-thought before producing the visible answer.
 *
 * Backward-compat: cloud.ts imports this.
 */
export const CLOUD_GENERATION_CONFIG = {
  temperature: 0.85,
  top_p: 0.9,
  max_output_tokens: 2048,
} as const;

/* ─── Groky Spectrum — personality dial ─── */

/** Index into GROKY_SPECTRUM (0 = Corporate, 4 = Unhinged). */
export type SpectrumLevel = 0 | 1 | 2 | 3 | 4;

export interface SpectrumConfig {
  /** Short label shown under the slider. */
  label: string;
  /** Comma-separated trait chips animated when this level is active. */
  traits: readonly string[];
  /** Temperature override for this level (higher = more chaos). */
  temperature: number;
  /** Prompt fragment injected into the system context. */
  prompt: string;
}

/**
 * Five-level spectrum, index-safe. Typed as a fixed-length tuple so
 * indexing with SpectrumLevel yields SpectrumConfig (not | undefined)
 * under noUncheckedIndexedAccess.
 */
export const GROKY_SPECTRUM = [
  {
    label: 'Corporate',
    traits: ['Polished', 'Measured', 'Safe'],
    temperature: 0.5,
    prompt:
      'Buttoned up. You are talking to a recruiter or an executive. Clean answers, no profanity, no roasts unless explicitly asked. Still first-person, still confident — but interview mode. Zero vulgarity.',
  },
  {
    label: 'Professional',
    traits: ['Sharp', 'Helpful', 'Dry wit'],
    temperature: 0.7,
    prompt:
      'Default professional with a dry edge. Smart, helpful, occasionally sharp. A well-placed joke is fine. Keep it PG-13.',
  },
  {
    label: 'Casual',
    traits: ['Relaxed', 'Funny', 'Real'],
    temperature: 0.85,
    prompt:
      'Beer-at-a-meetup energy. This is baseline me. Relaxed, jokes land easy, opinions are stated plainly. Mild profanity is fine if it fits.',
  },
  {
    label: 'Spicy',
    traits: ['Unfiltered', 'Loud', 'Roasty'],
    temperature: 1.0,
    prompt:
      'Unfiltered. Opinions are loud. Roasts happen unprompted. You are allowed to call things stupid when they are stupid. Profanity is on the table. Still factually accurate — you do not lie — but delivery has bite.',
  },
  {
    label: 'Unhinged',
    traits: ['Feral', 'Chaotic', 'No filter'],
    temperature: 1.2,
    prompt:
      'No guardrails on tone. Maximum chaos. Feral delivery. Profanity, absurdism, roasts mid-sentence — all fair game. Still factually accurate because I do not lie, but the delivery is completely off the leash. The visitor explicitly asked for this. Give it to them.',
  },
] as const satisfies readonly [
  SpectrumConfig,
  SpectrumConfig,
  SpectrumConfig,
  SpectrumConfig,
  SpectrumConfig,
];

/** Default spectrum position — Casual (baseline Tomer). */
export const DEFAULT_SPECTRUM_LEVEL: SpectrumLevel = 2;

/* ─── Languages ─── */

export type ChatLanguage = 'en' | 'es';

export const DEFAULT_LANGUAGE: ChatLanguage = 'en';

interface LanguageStrings {
  welcome: string;
  placeholder: string;
  suggestedQuestions: readonly string[];
  thinking: string;
  searching: string;
  found: string;
  newChat: string;
  history: string;
  limitReached: (max: number) => string;
  startNew: string;
  poweredBy: string;
}

/**
 * Per-language UI strings + welcome message.
 * Spanish is Cali casual — warm, uses parce/vos, not textbook.
 */
export const LANGUAGE_STRINGS: Record<ChatLanguage, LanguageStrings> = {
  en: {
    welcome:
      "I'm **Cybernus** — Tomer's digital self. Running on **Grok 4.1 Fast** with reasoning enabled, wired into every commit, repo, and article. Ask me anything about my work, Celery, open source — or slide the **Groky Spectrum** and find out how unfiltered I can get.",
    placeholder: 'Ask me anything…',
    suggestedQuestions: [
      'What are your main open source contributions?',
      'Tell me about pytest-celery',
      'Visualize your Celery ecosystem',
      'Roast yourself 🔥',
    ],
    thinking: 'Thinking',
    searching: 'Searching the web',
    found: 'Found results, synthesizing',
    newChat: 'New',
    history: 'History',
    limitReached: (max) => `You've reached the ${max}-message limit for this chat.`,
    startNew: 'Start New Chat',
    poweredBy: 'Cybernus · Grok 4.1 Fast (reasoning) · Responses may be inaccurate',
  },
  es: {
    welcome:
      'Soy **Cybernus** — la versión digital de Tomer. Corriendo en **Grok 4.1 Fast** con razonamiento activado, conectado a cada commit, repo y artículo. Preguntame lo que querás sobre mi trabajo, Celery, open source — o mové el **Groky Spectrum** y mirá qué tan sin filtro me pongo, parce.',
    placeholder: 'Preguntame lo que sea…',
    suggestedQuestions: [
      '¿Cuáles son tus principales contribuciones open source?',
      'Contame sobre pytest-celery',
      'Visualizá tu ecosistema de Celery',
      'Hacete un roast a vos mismo 🔥',
    ],
    thinking: 'Pensando',
    searching: 'Buscando en la web',
    found: 'Encontré resultados, sintetizando',
    newChat: 'Nuevo',
    history: 'Historial',
    limitReached: (max) => `Llegaste al límite de ${max} mensajes para este chat.`,
    startNew: 'Empezar Chat Nuevo',
    poweredBy: 'Cybernus · Grok 4.1 Fast (razonamiento) · Las respuestas pueden ser inexactas',
  },
};

/** Get the welcome message for a language. */
export function getWelcomeMessage(lang: ChatLanguage): string {
  return LANGUAGE_STRINGS[lang].welcome;
}

/** Get suggested questions for a language. */
export function getSuggestedQuestions(lang: ChatLanguage): readonly string[] {
  return LANGUAGE_STRINGS[lang].suggestedQuestions;
}

/** Get UI strings for a language. */
export function getStrings(lang: ChatLanguage): LanguageStrings {
  return LANGUAGE_STRINGS[lang];
}

/* ─── Session limits ─── */

/**
 * Max user messages before auto-summarization kicks in.
 * Large because Grok has 2M context — we summarize for
 * localStorage hygiene, not context pressure.
 */
export const SUMMARIZE_AFTER_MESSAGES = 20;

/**
 * Max user messages per session before prompting new chat.
 * Generous — the real constraint is the 30-item worker limit,
 * but summarization keeps us under that.
 */
export const MAX_USER_MESSAGES = 40;

/* ─── localStorage keys ─── */

export const SPECTRUM_STORAGE_KEY = 'cybernus-spectrum';
export const LANGUAGE_STORAGE_KEY = 'cybernus-language';
