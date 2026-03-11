/**
 * Cybernus Configuration — single model, single identity.
 *
 * Grok 4 (latest) via xAI Responses API through the Cloudflare Worker.
 */

export { WORKER_AI_URL as CLOUD_PROXY_URL, WORKER_BASE_URL } from '@config';

/** The sole model — Grok 4 latest. */
export const MODEL_ID = 'grok-4-1-fast';
export const MODEL_NAME = 'Grok 4.1 Fast';

/** Generation parameters. */
export const GENERATION_CONFIG = {
  temperature: 0.85,
  top_p: 0.9,
  max_output_tokens: 1024,
} as const;

/** Maximum user messages per session. */
export const MAX_USER_MESSAGES = 30;

/** Maximum characters in conversation history sent to API. */
const MAX_HISTORY_CHARS = 50_000;

/** Trim conversation history for token efficiency. */
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

/** Default voice for TTS (Rex — confident, clear, male). */
export const DEFAULT_VOICE_ID = 'rex';

/** Alias for use in VoiceService. */
export const CYBERNUS_VOICE_ID = DEFAULT_VOICE_ID;

/** Maximum duration for live voice conversations (seconds). */
export const VOICE_LIVE_LIMIT_SECONDS = 120;

/** Available xAI TTS voices. */
export const VOICE_OPTIONS = [
  { id: 'rex', name: 'Rex', tone: 'Confident, clear', gender: 'Male' },
  { id: 'leo', name: 'Leo', tone: 'Authoritative, strong', gender: 'Male' },
  { id: 'eve', name: 'Eve', tone: 'Energetic, upbeat', gender: 'Female' },
  { id: 'ara', name: 'Ara', tone: 'Warm, friendly', gender: 'Female' },
  { id: 'sal', name: 'Sal', tone: 'Smooth, balanced', gender: 'Neutral' },
] as const;

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
  {
    icon: '👑',
    label: 'Open Source Empire',
    prompt:
      'How does Tomer lead the Celery organization? What does it take to manage 10+ packages powering companies like Instagram and Robinhood?',
  },
  {
    icon: '🎨',
    label: 'Draw Me',
    prompt:
      'Draw a portrait of Tomer Nosrati — show me what the architect of the Matrix looks like',
  },
] as const;
