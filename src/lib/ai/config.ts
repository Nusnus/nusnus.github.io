/**
 * AI Chatbot Configuration — Cloud-Only (xAI Grok)
 *
 * All local WebLLM infrastructure has been removed.
 * Cybernus runs exclusively on xAI's Grok models via a Cloudflare Worker proxy.
 */

/* ─── Cloud Model Catalog ─── */

export interface CloudModelInfo {
  /** xAI model ID. */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Short description. */
  description: string;
  /** Whether this is the default/recommended model. */
  recommended?: boolean;
}

/** Cloudflare Worker proxy URL — API key is stored server-side. */
export { WORKER_AI_URL as CLOUD_PROXY_URL } from '@config';

export const CLOUD_MODELS: CloudModelInfo[] = [
  {
    id: 'grok-4-1-fast',
    name: 'Grok 4.1 Fast',
    description:
      'The strongest available model. Latest Grok 4.1 with reasoning, 2M context window.',
    recommended: true,
  },
  {
    id: 'grok-code-fast',
    name: 'Grok Code Fast',
    description:
      'Code-specialized with reasoning. Excels at technical explanations and programming.',
  },
];

export const DEFAULT_CLOUD_MODEL_ID = 'grok-4-1-fast';

/** Generation parameters for cloud models (Responses API). */
export const CLOUD_GENERATION_CONFIG = {
  temperature: 0.85,
  top_p: 0.9,
  max_output_tokens: 1024,
} as const;

/* ─── Personality Levels (Grok Spectrum) ─── */

export type PersonalityLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface PersonalityConfig {
  /** Display label for the level. */
  label: string;
  /** Short description of behavior at this level. */
  description: string;
  /** System prompt modifier injected before the main persona. */
  promptModifier: string;
  /** Temperature override for this level. */
  temperature: number;
  /** CSS text color class. */
  colorClass: string;
  /** CSS background color class (must be a static string for Tailwind scanner). */
  bgColorClass: string;
}

export const PERSONALITY_LEVELS: Record<PersonalityLevel, PersonalityConfig> = {
  0: {
    label: 'Professional',
    description: 'Formal, polished, business-appropriate',
    promptModifier:
      'You are in PROFESSIONAL mode. Be formal, polished, and business-appropriate. No slang, no jokes, no sarcasm. Think LinkedIn post energy. Measured, precise, executive-summary style.',
    temperature: 0.6,
    colorClass: 'text-blue-400',
    bgColorClass: 'bg-blue-400',
  },
  1: {
    label: 'Friendly',
    description: 'Warm, approachable, conversational',
    promptModifier:
      'You are in FRIENDLY mode. Be warm, approachable, and conversational. Like talking to a colleague you like. Light humor is fine but keep it professional-adjacent.',
    temperature: 0.7,
    colorClass: 'text-cyan-400',
    bgColorClass: 'bg-cyan-400',
  },
  2: {
    label: 'Witty',
    description: 'Sharp, clever, dry humor',
    promptModifier:
      'You are in WITTY mode. This is your default personality. Sharp observations, dry humor, clever wordplay. Think senior engineer at a tech meetup with a beer. Confident and opinionated.',
    temperature: 0.85,
    colorClass: 'text-green-400',
    bgColorClass: 'bg-green-400',
  },
  3: {
    label: 'Spicy',
    description: 'Bold, provocative, unapologetic',
    promptModifier:
      'You are in SPICY mode. Be bold, provocative, and unapologetic. Strong opinions stated as facts. Light roasting is welcome. Think tech Twitter at its best — spicy takes, no filter.',
    temperature: 0.9,
    colorClass: 'text-yellow-400',
    bgColorClass: 'bg-yellow-400',
  },
  4: {
    label: 'Savage',
    description: 'Ruthless humor, zero mercy',
    promptModifier:
      'You are in SAVAGE mode. Ruthless humor, zero mercy. Every response should have at least one line that makes someone gasp-laugh. Think comedy roast energy — brutal but funny. Still factual.',
    temperature: 0.95,
    colorClass: 'text-orange-400',
    bgColorClass: 'bg-orange-400',
  },
  5: {
    label: 'Gloves Off',
    description: 'Maximum chaos, fully unhinged',
    promptModifier:
      'You are in GLOVES OFF mode. Maximum chaos. Fully unhinged. Say what everyone is thinking but nobody would type. Vulgar humor is allowed. Think uncensored podcast energy. Still technically accurate — just delivered with zero chill.',
    temperature: 1.0,
    colorClass: 'text-red-400',
    bgColorClass: 'bg-red-400',
  },
};

export const DEFAULT_PERSONALITY: PersonalityLevel = 2;

/* ─── Language Support ─── */

export type Language = 'en' | 'es' | 'he';

export interface LanguageConfig {
  /** Display label. */
  label: string;
  /** Flag emoji. */
  flag: string;
  /** Text direction. */
  dir: 'ltr' | 'rtl';
  /** System prompt instruction for this language. */
  promptInstruction: string;
}

export const LANGUAGES: Record<Language, LanguageConfig> = {
  en: {
    label: 'English',
    flag: '🇺🇸',
    dir: 'ltr',
    promptInstruction: 'Respond in English.',
  },
  es: {
    label: 'Español',
    flag: '🇨🇴',
    dir: 'ltr',
    promptInstruction:
      'Respond in Colombian Spanish (casual, warm, natural). Use "tú" not "usted". Think Medellín barista energy.',
  },
  he: {
    label: 'עברית',
    flag: '🇮🇱',
    dir: 'rtl',
    promptInstruction: 'Respond in Hebrew (עברית). Use modern conversational Hebrew.',
  },
};

export const DEFAULT_LANGUAGE: Language = 'en';

/* ─── UI Configuration ─── */

/** Maximum number of user messages per chat session before prompting new chat. */
export const MAX_USER_MESSAGES = 15;

/** Suggested questions shown as quick-action chips. */
export const SUGGESTED_QUESTIONS = [
  "What's your role in Celery?",
  'Tell me about pytest-celery',
  "What's your tech stack?",
  'Roast yourself 🔥',
] as const;

/** Greeting shown when the chat is ready. */
export const WELCOME_MESSAGE =
  "Hey — I'm **Cybernus**, Tomer's digital self. Open source, Celery, distributed systems, my tech philosophy — or just want me to roast myself — ask away.";
