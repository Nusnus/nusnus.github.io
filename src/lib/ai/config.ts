/**
 * Cybernus AI Configuration — single model architecture.
 *
 * All inference runs through xAI Grok 4 via the Cloudflare Worker proxy.
 */

/* ─── Cloud Model Catalog ─── */

export interface CloudModelInfo {
  /** xAI model ID. */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Short description to help users pick. */
  description: string;
  /** Whether this is the default cloud model. */
  recommended?: boolean;
}

/** Cloudflare Worker proxy URL — API key is stored server-side. */
export { WORKER_AI_URL as CLOUD_PROXY_URL } from '@config';

/** Single model: Grok 4 (latest). */
export const CLOUD_MODELS: CloudModelInfo[] = [
  {
    id: 'grok-4-1-fast',
    name: 'Neural Core',
    description:
      'Advanced AI engine with reasoning, 2M context window, MCP tools, web search, and image generation.',
    recommended: true,
  },
];

export const DEFAULT_CLOUD_MODEL_ID = 'grok-4-1-fast';

/** Generation parameters for cloud models (large context, Responses API). */
export const CLOUD_GENERATION_CONFIG = {
  temperature: 0.85,
  top_p: 0.9,
  max_output_tokens: 1024,
} as const;

/** Maximum user messages per session before requiring a new chat. */
export const MAX_USER_MESSAGES = 30;

/**
 * Trim conversation history to fit within a reasonable token budget.
 * Cloud models have 2M context but we still trim for efficiency.
 */
const MAX_HISTORY_CHARS = 50_000;

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

/** Suggested questions shown on the welcome screen. */
export const SUGGESTED_QUESTIONS = [
  {
    icon: '🧬',
    label: 'The Origin Story',
    prompt: 'Who is Tomer Nosrati and how did he become the backbone of distributed Python?',
  },
  {
    icon: '🌿',
    label: 'Celery Deep Dive',
    prompt:
      'Break down the Celery project architecture — how does distributed task processing actually work?',
  },
  {
    icon: '🧪',
    label: 'pytest-celery',
    prompt: 'What is pytest-celery and why did Tomer build it from scratch?',
  },
  {
    icon: '🔥',
    label: 'Roast Mode',
    prompt: 'Roast Tomer Nosrati — no mercy, full send',
  },
] as const;
