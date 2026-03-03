/**
 * AI Chatbot Configuration
 *
 * Model selection, WebGPU detection, and system prompt for the in-browser
 * AI chatbot powered by WebLLM.
 */

/** Strongest available model — no shader-f16 needed for widest browser support. */
export const DEFAULT_MODEL_ID = 'Qwen2.5-7B-Instruct-q4f32_1-MLC';

/** Approximate download size shown to the user before they opt in. */
export const MODEL_DOWNLOAD_SIZE_LABEL = '~4 GB';

/** Generation parameters tuned for a concise, factual assistant. */
export const GENERATION_CONFIG = {
  temperature: 0.6,
  top_p: 0.9,
  max_tokens: 768,
  repetition_penalty: 1.05,
} as const;

/**
 * Rough context window budget.
 * Qwen2.5-7B has 4096 token context. We reserve space for the system prompt
 * (~1200 tokens) and the model's response (max_tokens = 768).
 * That leaves ~2100 tokens for conversation history.
 * At ~4 chars/token, that's roughly 8400 characters.
 */
const MAX_HISTORY_CHARS = 8000;

/**
 * Trim conversation history to fit within the context window.
 * Keeps the most recent messages, dropping oldest first.
 */
export function trimHistory(
  messages: { role: 'user' | 'assistant'; content: string }[],
): { role: 'user' | 'assistant'; content: string }[] {
  let totalChars = 0;
  const trimmed: typeof messages = [];

  // Walk backwards (newest first), accumulate until budget is exceeded
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

/** Suggested questions shown as quick-action chips. */
export const SUGGESTED_QUESTIONS = [
  "What are Tomer's main open source contributions?",
  'Tell me about the Celery project',
  'What is pytest-celery?',
  'What technologies does Tomer work with?',
] as const;

/** Greeting shown when the chat engine is ready. */
export const WELCOME_MESSAGE =
  "Hi! I'm an AI assistant that can answer questions about **Tomer Nosrati** — his open source work, the Celery project, and more. What would you like to know?";

/**
 * Detect whether the current browser supports WebGPU.
 * Returns `true` only when `navigator.gpu` exists AND an adapter can be obtained.
 */
export async function isWebGPUSupported(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !('gpu' in navigator)) return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- WebGPU types not in default lib
    const adapter = await (navigator as any).gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
}
