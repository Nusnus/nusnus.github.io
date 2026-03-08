/**
 * AI Chatbot Configuration
 *
 * Model catalog, WebGPU detection, and generation settings for the in-browser
 * AI chatbot powered by WebLLM.
 */

/* ─── Model Catalog ─── */

export type ModelGroup = 'top' | 'more';

export interface ModelInfo {
  /** WebLLM model ID — must match a prebuilt model in @mlc-ai/web-llm. */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Model family for grouping (e.g. "Qwen", "Llama", "Phi"). */
  family: string;
  /** Detailed description to help users pick. */
  description: string;
  /** Parameter count label (e.g. "1.7B"). */
  params: string;
  /** Which group: 'top' (featured picks) or 'more' (all others). */
  group: ModelGroup;
  /** Approximate download size (e.g. "~1 GB"). */
  downloadSize: string;
  /** Approximate VRAM usage in MB. */
  vramMB: number;
  /** Quality tier for visual indicator. */
  quality: 'basic' | 'good' | 'great' | 'best';
  /** Whether this is the default/recommended model. */
  recommended?: boolean;
}

export const GROUP_INFO: Record<ModelGroup, { label: string; subtitle: string }> = {
  top: {
    label: 'Top Picks',
    subtitle: 'The strongest and most capable models — pick one of these for best results',
  },
  more: {
    label: 'More Models',
    subtitle: 'Lighter alternatives for faster downloads or lower-end hardware',
  },
};

/**
 * Curated list of models — all use q4f32_1 quantization (no shader-f16 needed)
 * for widest browser compatibility.
 */
export const AVAILABLE_MODELS: ModelInfo[] = [
  /* ═══════════════════════════════════════════════════
   *  TOP PICKS — strongest models, shown first
   * ═══════════════════════════════════════════════════ */
  {
    id: 'gemma-2-9b-it-q4f32_1-MLC',
    name: 'Gemma 2 9B',
    family: 'Gemma',
    description:
      'The absolute strongest model available. 9 billion parameters by Google — top-tier reasoning, knowledge, and instruction following. Pick this if you want the best quality and have the VRAM for it.',
    params: '9B',
    group: 'top',
    downloadSize: '~5.5 GB',
    vramMB: 8383,
    quality: 'best',
    recommended: true,
  },
  {
    id: 'Qwen3-8B-q4f32_1-MLC',
    name: 'Qwen3 8B',
    family: 'Qwen',
    description:
      'Latest generation Qwen architecture (2025). Excellent reasoning with the newest training techniques. The most modern 8B model available — great alternative if Gemma 9B is too heavy.',
    params: '8B',
    group: 'top',
    downloadSize: '~4.5 GB',
    vramMB: 6853,
    quality: 'best',
  },
  {
    id: 'DeepSeek-R1-Distill-Llama-8B-q4f32_1-MLC',
    name: 'DeepSeek-R1 Llama 8B',
    family: 'DeepSeek',
    description:
      'DeepSeek-R1 reasoning distilled into Llama 8B. Specializes in analytical thinking, step-by-step problem solving, and complex questions. Best choice for reasoning-heavy conversations.',
    params: '8B',
    group: 'top',
    downloadSize: '~4.5 GB',
    vramMB: 6101,
    quality: 'best',
  },
  {
    id: 'Llama-3.1-8B-Instruct-q4f32_1-MLC',
    name: 'Llama 3.1 8B',
    family: 'Llama',
    description:
      "Meta's flagship 8B model. The most well-rounded option — outstanding instruction following, broad knowledge, and reliable factual accuracy. A safe all-purpose pick.",
    params: '8B',
    group: 'top',
    downloadSize: '~4.5 GB',
    vramMB: 6101,
    quality: 'best',
  },
  {
    id: 'Qwen2.5-7B-Instruct-q4f32_1-MLC',
    name: 'Qwen 2.5 7B',
    family: 'Qwen',
    description:
      'Top-tier general model by Alibaba. Excellent reasoning, knowledge, and multilingual ability. Slightly smaller download than the 8B models while still delivering near-best quality.',
    params: '7B',
    group: 'top',
    downloadSize: '~4 GB',
    vramMB: 5900,
    quality: 'best',
  },
  {
    id: 'Phi-3.5-mini-instruct-q4f32_1-MLC',
    name: 'Phi 3.5 Mini',
    family: 'Phi',
    description:
      "Best bang for buck. Microsoft's 3.8B model trained on textbook-quality data delivers near-7B quality at half the download size. Ideal if you want strong answers without a large download.",
    params: '3.8B',
    group: 'top',
    downloadSize: '~2.2 GB',
    vramMB: 5483,
    quality: 'great',
  },
  /* ═══════════════════════════════════════════════════
   *  MORE MODELS — lighter alternatives
   * ═══════════════════════════════════════════════════ */
  {
    id: 'DeepSeek-R1-Distill-Qwen-7B-q4f32_1-MLC',
    name: 'DeepSeek-R1 Qwen 7B',
    family: 'DeepSeek',
    description:
      'Reasoning-distilled from DeepSeek-R1 into Qwen 7B. Strong chain-of-thought and analytical abilities.',
    params: '7B',
    group: 'more',
    downloadSize: '~4 GB',
    vramMB: 5900,
    quality: 'great',
  },
  {
    id: 'Qwen2.5-Coder-7B-Instruct-q4f32_1-MLC',
    name: 'Qwen 2.5 Coder 7B',
    family: 'Qwen',
    description:
      'Code-specialized Qwen variant. Excels at technical explanations and programming topics.',
    params: '7B',
    group: 'more',
    downloadSize: '~4 GB',
    vramMB: 5900,
    quality: 'great',
  },
  {
    id: 'Mistral-7B-Instruct-v0.3-q4f32_1-MLC',
    name: 'Mistral 7B v0.3',
    family: 'Mistral',
    description:
      "Mistral AI's flagship open model. Strong instruction following and creative text generation.",
    params: '7B',
    group: 'more',
    downloadSize: '~3.5 GB',
    vramMB: 5619,
    quality: 'great',
  },
  {
    id: 'Qwen3-4B-q4f32_1-MLC',
    name: 'Qwen3 4B',
    family: 'Qwen',
    description:
      'Latest gen Qwen at 4B params. Fast and modern — great mid-tier choice with newest architecture.',
    params: '4B',
    group: 'more',
    downloadSize: '~2.5 GB',
    vramMB: 4328,
    quality: 'good',
  },
  {
    id: 'Llama-3.2-3B-Instruct-q4f32_1-MLC',
    name: 'Llama 3.2 3B',
    family: 'Llama',
    description:
      "Meta's balanced 3B model. Great quality-to-speed ratio, solid for most conversations.",
    params: '3B',
    group: 'more',
    downloadSize: '~1.8 GB',
    vramMB: 2952,
    quality: 'good',
  },
  {
    id: 'Qwen2.5-3B-Instruct-q4f32_1-MLC',
    name: 'Qwen 2.5 3B',
    family: 'Qwen',
    description:
      'Strong mid-tier model. Noticeable quality jump over smaller models with moderate resource use.',
    params: '3B',
    group: 'more',
    downloadSize: '~1.8 GB',
    vramMB: 2894,
    quality: 'good',
  },
  {
    id: 'gemma-2-2b-it-q4f32_1-MLC',
    name: 'Gemma 2 2B',
    family: 'Gemma',
    description:
      "Google's compact open model. Punches above its weight class with high-quality training data.",
    params: '2B',
    group: 'more',
    downloadSize: '~1 GB',
    vramMB: 2509,
    quality: 'good',
  },
  {
    id: 'Qwen3-1.7B-q4f32_1-MLC',
    name: 'Qwen3 1.7B',
    family: 'Qwen',
    description: 'Latest gen Qwen in a tiny package. Newest architecture at minimal resource cost.',
    params: '1.7B',
    group: 'more',
    downloadSize: '~1 GB',
    vramMB: 2635,
    quality: 'basic',
  },
  {
    id: 'SmolLM2-1.7B-Instruct-q4f32_1-MLC',
    name: 'SmolLM2 1.7B',
    family: 'SmolLM',
    description:
      "HuggingFace's efficient small model. Good general knowledge with fast inference speed.",
    params: '1.7B',
    group: 'more',
    downloadSize: '~1 GB',
    vramMB: 2692,
    quality: 'basic',
  },
  {
    id: 'Qwen2.5-1.5B-Instruct-q4f32_1-MLC',
    name: 'Qwen 2.5 1.5B',
    family: 'Qwen',
    description:
      'Compact yet capable. Handles basic Q&A well and works smoothly on phones and tablets.',
    params: '1.5B',
    group: 'more',
    downloadSize: '~1 GB',
    vramMB: 1889,
    quality: 'basic',
  },
  {
    id: 'Llama-3.2-1B-Instruct-q4f32_1-MLC',
    name: 'Llama 3.2 1B',
    family: 'Llama',
    description:
      "Meta's smallest Llama 3 model. Modern architecture with instruction tuning in a tiny package.",
    params: '1B',
    group: 'more',
    downloadSize: '~0.7 GB',
    vramMB: 1129,
    quality: 'basic',
  },
  {
    id: 'TinyLlama-1.1B-Chat-v1.0-q4f32_1-MLC',
    name: 'TinyLlama 1.1B',
    family: 'Llama',
    description:
      'Ultra-lightweight chat model. Loads in seconds, runs on virtually any device with WebGPU.',
    params: '1.1B',
    group: 'more',
    downloadSize: '~0.6 GB',
    vramMB: 840,
    quality: 'basic',
  },
  {
    id: 'Qwen3-0.6B-q4f32_1-MLC',
    name: 'Qwen3 0.6B',
    family: 'Qwen',
    description:
      'Smallest Qwen3 model. Lightning-fast responses, ideal for testing or very constrained devices.',
    params: '0.6B',
    group: 'more',
    downloadSize: '~0.5 GB',
    vramMB: 1925,
    quality: 'basic',
  },
  {
    id: 'Qwen2.5-0.5B-Instruct-q4f32_1-MLC',
    name: 'Qwen 2.5 0.5B',
    family: 'Qwen',
    description: 'Smallest Qwen 2.5 model. Ultra-fast responses for quick testing on any hardware.',
    params: '0.5B',
    group: 'more',
    downloadSize: '~0.4 GB',
    vramMB: 1060,
    quality: 'basic',
  },
];

/** Default local model — strongest available for best quality. */
export const DEFAULT_MODEL_ID = 'gemma-2-9b-it-q4f32_1-MLC';

/* ─── Provider Configuration ─── */

export type ChatProvider = 'cloud' | 'local';

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

export const CLOUD_MODELS: CloudModelInfo[] = [
  {
    id: 'grok-4-1-fast',
    name: 'Grok 4.1 Fast',
    description:
      'The strongest available model. Latest Grok 4.1 with reasoning, 2M context window. Best for in-depth questions.',
    recommended: true,
  },
  {
    id: 'grok-code-fast',
    name: 'Grok Code Fast',
    description:
      'Code-specialized with reasoning. Excels at technical explanations, programming topics, and code analysis.',
  },
];

export const DEFAULT_CLOUD_MODEL_ID = 'grok-4-1-fast';

/** Generation parameters for local WebLLM models (4K context). */
export const GENERATION_CONFIG = {
  temperature: 0.6,
  top_p: 0.9,
  max_tokens: 512,
  repetition_penalty: 1.05,
} as const;

/** Generation parameters for cloud models (large context, Responses API). */
export const CLOUD_GENERATION_CONFIG = {
  temperature: 0.85,
  top_p: 0.9,
  max_output_tokens: 1024,
} as const;

/**
 * Rough context window budget.
 * All WebLLM models have a 4096-token context window.
 *
 * Budget breakdown:
 *   System prompt (compact core + live stats + tools) ≈ 800 tokens
 *   RAG context (injected per-query)                  ≈ 400 tokens
 *   Runtime context (activity feed)                   ≈ 200 tokens
 *   Model response (max_tokens)                       = 512 tokens
 *   ─────────────────────────────────────────────────────────────
 *   Remaining for history                             ≈ 2100 tokens
 *   At ~4 chars/token                                 ≈ 8400 characters
 *
 * We use 4000 chars to leave a safety margin.
 */
const MAX_HISTORY_CHARS = 4000;

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
  'What makes Tomer the #3 Celery contributor of all time?',
  'How does pytest-celery actually work under the hood?',
  'Show me a visualization of his open source impact',
  'Roast Tomer Nosrati 🔥',
] as const;

/** Greeting shown when the chat engine is ready. */
export const WELCOME_MESSAGE =
  "Welcome to the simulation. I'm **Grok** — the AI running on **Tomer Nosrati's** digital real estate. Celery ecosystem, open source architecture, live GitHub stats, or a comedy roast of the man himself — pick your rabbit hole.";

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
