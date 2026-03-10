/**
 * Cybernus AI Configuration — single model, cloud-only architecture.
 *
 * All inference runs through xAI Grok 4 via the Cloudflare Worker proxy.
 * Single model eliminates choice paralysis and ensures consistent quality.
 */

/* ─── Model Configuration ─── */

/** The sole model powering Cybernus — Grok 4 latest. */
export const MODEL_ID = 'grok-4-1-fast';
export const MODEL_NAME = 'Grok 4';

/** Cloudflare Worker proxy URL — API key is stored server-side. */
export { WORKER_AI_URL as CLOUD_PROXY_URL } from '@config';

/** Generation parameters for cloud model (large context, Responses API). */
export const CLOUD_GENERATION_CONFIG = {
  temperature: 0.85,
  top_p: 0.9,
  max_output_tokens: 2048,
} as const;

/** Maximum user messages per session before requiring a new chat. */
export const MAX_USER_MESSAGES = 50;

/**
 * Trim conversation history to fit within a reasonable token budget.
 * Grok 4 has 2M context but we trim for efficiency.
 */
const MAX_HISTORY_CHARS = 80_000;

export function trimHistory(
  messages: { role: 'user' | 'assistant'; content: string }[],
): { role: 'user' | 'assistant'; content: string }[] {
  let totalChars = 0;
  const trimmed: typeof messages = [];

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg) continue;
    const msgChars = msg.content.length;
    if (totalChars + msgChars > MAX_HISTORY_CHARS && trimmed.length > 0) break;
    totalChars += msgChars;
    trimmed.unshift(msg);
  }

  return trimmed;
}

/** Suggested questions shown as quick-action chips (per language). */
export const SUGGESTED_QUESTIONS = {
  en: [
    "What are Tomer's main open source contributions?",
    'Tell me about the Celery project',
    'What is pytest-celery and how does it work?',
    'Show me a visual breakdown of your GitHub activity',
  ],
  es: [
    'Cuales son las principales contribuciones de Tomer?',
    'Cuentame sobre el proyecto Celery',
    'Que es pytest-celery y como funciona?',
    'Muestrame un diagrama de tu actividad en GitHub',
  ],
  he: [
    'מה התרומות העיקריות של תומר לקוד פתוח?',
    'ספר לי על פרויקט Celery',
    'מה זה pytest-celery ואיך זה עובד?',
    'הראה לי ויזואליזציה של הפעילות שלך ב-GitHub',
  ],
} as const;

// ── Legacy compatibility exports ──
// These re-exports maintain backwards compatibility with components
// that still import from the old multi-model API.

export interface CloudModelInfo {
  id: string;
  name: string;
  description: string;
  recommended?: boolean;
}

export const CLOUD_MODELS: CloudModelInfo[] = [
  {
    id: MODEL_ID,
    name: MODEL_NAME,
    description: 'The strongest available model. Grok 4 with reasoning, 2M context window.',
    recommended: true,
  },
];

export const DEFAULT_CLOUD_MODEL_ID = MODEL_ID;
