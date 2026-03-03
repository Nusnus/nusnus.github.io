/**
 * AI Chatbot Configuration
 *
 * Model catalog, WebGPU detection, and generation settings for the in-browser
 * AI chatbot powered by WebLLM.
 */

/* ─── Model Catalog ─── */

export interface ModelInfo {
  /** WebLLM model ID — must match a prebuilt model in @mlc-ai/web-llm. */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Model family for grouping (e.g. "Qwen", "Llama", "Phi"). */
  family: string;
  /** Short tagline. */
  description: string;
  /** Parameter count label (e.g. "1.7B"). */
  params: string;
  /** Approximate download size (e.g. "~1 GB"). */
  downloadSize: string;
  /** Approximate VRAM usage in MB. */
  vramMB: number;
  /** Quality tier for visual indicator. */
  quality: 'basic' | 'good' | 'great' | 'best';
  /** Whether this is the default/recommended model. */
  recommended?: boolean;
}

/**
 * Curated list of models — all use q4f32_1 quantization (no shader-f16 needed)
 * for widest browser compatibility. Ordered from smallest to largest.
 */
export const AVAILABLE_MODELS: ModelInfo[] = [
  // ── Tiny (< 1.5B) ──
  {
    id: 'Qwen2.5-0.5B-Instruct-q4f32_1-MLC',
    name: 'Qwen 2.5 0.5B',
    family: 'Qwen',
    description: 'Smallest Qwen — ultra-fast responses',
    params: '0.5B',
    downloadSize: '~0.4 GB',
    vramMB: 1060,
    quality: 'basic',
  },
  {
    id: 'TinyLlama-1.1B-Chat-v1.0-q4f32_1-MLC',
    name: 'TinyLlama 1.1B',
    family: 'Llama',
    description: 'Ultra-lightweight, nearly instant',
    params: '1.1B',
    downloadSize: '~0.6 GB',
    vramMB: 840,
    quality: 'basic',
  },
  {
    id: 'Llama-3.2-1B-Instruct-q4f32_1-MLC',
    name: 'Llama 3.2 1B',
    family: 'Llama',
    description: "Meta's smallest Llama 3 model",
    params: '1B',
    downloadSize: '~0.7 GB',
    vramMB: 1129,
    quality: 'basic',
  },
  // ── Small (1.5B – 2B) ──
  {
    id: 'Qwen2.5-1.5B-Instruct-q4f32_1-MLC',
    name: 'Qwen 2.5 1.5B',
    family: 'Qwen',
    description: 'Compact Qwen for low-end devices',
    params: '1.5B',
    downloadSize: '~1 GB',
    vramMB: 1889,
    quality: 'basic',
  },
  {
    id: 'SmolLM2-1.7B-Instruct-q4f32_1-MLC',
    name: 'SmolLM2 1.7B',
    family: 'SmolLM',
    description: 'Lightweight & fast general assistant',
    params: '1.7B',
    downloadSize: '~1 GB',
    vramMB: 2692,
    quality: 'basic',
  },
  {
    id: 'gemma-2-2b-it-q4f32_1-MLC',
    name: 'Gemma 2 2B',
    family: 'Gemma',
    description: "Google's compact open model",
    params: '2B',
    downloadSize: '~1 GB',
    vramMB: 2509,
    quality: 'good',
  },
  // ── Medium (3B) ──
  {
    id: 'Qwen2.5-3B-Instruct-q4f32_1-MLC',
    name: 'Qwen 2.5 3B',
    family: 'Qwen',
    description: 'Strong mid-tier from the Qwen family',
    params: '3B',
    downloadSize: '~1.8 GB',
    vramMB: 2894,
    quality: 'good',
  },
  {
    id: 'Llama-3.2-3B-Instruct-q4f32_1-MLC',
    name: 'Llama 3.2 3B',
    family: 'Llama',
    description: 'Balanced quality & speed by Meta',
    params: '3B',
    downloadSize: '~1.8 GB',
    vramMB: 2952,
    quality: 'good',
  },
  {
    id: 'Phi-3.5-mini-instruct-q4f32_1-MLC',
    name: 'Phi 3.5 Mini',
    family: 'Phi',
    description: "Microsoft's compact powerhouse",
    params: '3.8B',
    downloadSize: '~2.2 GB',
    vramMB: 5483,
    quality: 'great',
  },
  // ── Large (7B+) ──
  {
    id: 'Mistral-7B-Instruct-v0.3-q4f32_1-MLC',
    name: 'Mistral 7B v0.3',
    family: 'Mistral',
    description: "Mistral's flagship open model",
    params: '7B',
    downloadSize: '~3.5 GB',
    vramMB: 5619,
    quality: 'great',
  },
  {
    id: 'Qwen2.5-7B-Instruct-q4f32_1-MLC',
    name: 'Qwen 2.5 7B',
    family: 'Qwen',
    description: 'Best reasoning & accuracy',
    params: '7B',
    downloadSize: '~4 GB',
    vramMB: 5900,
    quality: 'best',
    recommended: true,
  },
  {
    id: 'Qwen2.5-Coder-7B-Instruct-q4f32_1-MLC',
    name: 'Qwen 2.5 Coder 7B',
    family: 'Qwen',
    description: 'Code-specialized variant',
    params: '7B',
    downloadSize: '~4 GB',
    vramMB: 5900,
    quality: 'great',
  },
  {
    id: 'DeepSeek-R1-Distill-Qwen-7B-q4f32_1-MLC',
    name: 'DeepSeek-R1 Qwen 7B',
    family: 'DeepSeek',
    description: 'Reasoning-focused distillation',
    params: '7B',
    downloadSize: '~4 GB',
    vramMB: 5900,
    quality: 'great',
  },
  {
    id: 'Llama-3.1-8B-Instruct-q4f32_1-MLC',
    name: 'Llama 3.1 8B',
    family: 'Llama',
    description: "Meta's strong 8B reasoning model",
    params: '8B',
    downloadSize: '~4.5 GB',
    vramMB: 6101,
    quality: 'best',
  },
  {
    id: 'DeepSeek-R1-Distill-Llama-8B-q4f32_1-MLC',
    name: 'DeepSeek-R1 Llama 8B',
    family: 'DeepSeek',
    description: 'Reasoning-focused, Llama-based',
    params: '8B',
    downloadSize: '~4.5 GB',
    vramMB: 6101,
    quality: 'best',
  },
];

/** Default model for first-time users. */
export const DEFAULT_MODEL_ID = 'Qwen2.5-7B-Instruct-q4f32_1-MLC';

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
