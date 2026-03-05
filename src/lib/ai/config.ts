/**
 * Cybernus — AI chat configuration.
 *
 * Single cloud model (Grok 4.1 Fast Reasoning) via the Cloudflare Worker
 * proxy. Local WebLLM mode is gone — the page drops straight into chat.
 */

/* ─── Model ─── */

/**
 * The one and only model. Grok 4.1 Fast with always-on reasoning.
 * 2M token context window — we feed it everything.
 */
export const CYBERNUS_MODEL_ID = 'grok-4-1-fast-reasoning';

/** Legacy export — RoastWidget still imports DEFAULT_CLOUD_MODEL_ID. */
export const DEFAULT_CLOUD_MODEL_ID = CYBERNUS_MODEL_ID;

/** Human-readable model metadata shown in the UI. */
export const MODEL_META = {
  id: CYBERNUS_MODEL_ID,
  name: 'Grok 4.1 Fast',
  vendor: 'xAI',
  contextWindow: '2M tokens',
  reasoning: 'always on',
  capabilities: ['web search', 'code execution', 'MCP tools', 'function calling'],
} as const;

/** Cloudflare Worker proxy URL — API key is stored server-side. */
export { WORKER_AI_URL as CLOUD_PROXY_URL } from '@config';

/* ─── Generation ─── */

/**
 * Base generation config. `temperature` is overridden per-request by the
 * active spectrum notch. Reasoning models reject presence/frequency penalty.
 */
export const GENERATION_CONFIG = {
  top_p: 0.9,
  max_output_tokens: 2048,
} as const;

/* ─── UI ─── */

export const AGENT_NAME = 'Cybernus';

/** Max user messages before we nudge toward a new chat. */
export const MAX_USER_MESSAGES = 30;

/** Suggested questions shown as quick-action chips. */
export const SUGGESTED_QUESTIONS = [
  "What's your biggest contribution to Celery?",
  'Show me the Celery ecosystem architecture',
  'Dig into the pytest-celery codebase',
  'Roast yourself 🔥',
] as const;

/** Greeting shown when the chat is ready — first-person as Tomer. */
export const WELCOME_MESSAGE =
  "Hey. I'm Tomer — well, the version of me that lives in this website. **Cybernus**, if you want the Matrix name. " +
  'Every repo, every commit, every article — all loaded into context. ' +
  'Celery internals, open source leadership, distributed systems, whatever. English or Spanish. ' +
  'Slide the personality dial on the right if you want me unhinged. ' +
  "What's up?";
