/**
 * AI configuration — Cybernus agent.
 *
 * Single canonical model: `grok-4-1-fast-reasoning`.
 * No model picker, no local mode, no WebLLM. The Cloudflare Worker
 * enforces the model allowlist server-side regardless of what the
 * client sends.
 *
 * This module stays intentionally small. The heavy Cybernus-specific
 * logic (spectrum, context building, runtime environment) lives in
 * `@lib/cybernus/`.
 */

/** Cloudflare Worker proxy URL — xAI API key lives server-side only. */
export { WORKER_AI_URL as CLOUD_PROXY_URL } from '@config';

/**
 * The single model Cybernus runs on.
 *
 * `grok-4-1-fast-reasoning` is xAI's strongest available model as of 2026:
 * always-on internal reasoning (encrypted, not displayable — only the
 * token count surfaces), 2M context window, native MCP + code_interpreter
 * + web_search. Grok 4 does NOT accept `reasoning_effort`, `stop`,
 * `presencePenalty`, or `frequencyPenalty` — sending them errors the request.
 *
 * Also imported by RoastWidget — do not rename without updating it.
 */
export const DEFAULT_CLOUD_MODEL_ID = 'grok-4-1-fast-reasoning';

/** Human-readable model metadata for the UI badge. */
export const CYBERNUS_MODEL = {
  id: DEFAULT_CLOUD_MODEL_ID,
  name: 'Grok 4.1 Fast',
  variant: 'Reasoning',
  provider: 'xAI',
  contextWindow: '2M',
  /** Features surfaced in the model info panel. */
  capabilities: ['Reasoning', 'Web Search', 'Code Execution', 'DeepWiki MCP'],
} as const;

/**
 * Generation parameters for the xAI Responses API.
 *
 * 4096 output tokens — enough for long-form answers with Mermaid diagrams
 * and code blocks. The Worker clamps this server-side anyway. Temperature
 * stays high (0.85) because Cybernus is a personality, not a doc-bot.
 */
export const CLOUD_GENERATION_CONFIG = {
  temperature: 0.85,
  top_p: 0.9,
  max_output_tokens: 4096,
} as const;

/**
 * Welcome messages shown when a fresh chat loads, one per UI language.
 *
 * Cybernus speaks AS Tomer — first person, Matrix-aware, slightly meta.
 * Rendered as markdown (bold + italic work here).
 */
export const WELCOME_MESSAGE = {
  en: "I'm **Cybernus** — Tomer Nosrati's digital self. Same opinions, same commits, fewer biological constraints. Ask me about Celery, open source, distributed systems, or drag that slider to the right and find out what happens. *Wake up, Neo.*",
  es: 'Soy **Cybernus** — el yo digital de Tomer Nosrati. Mismas opiniones, mismos commits, menos limitaciones biológicas. Pregúntame sobre Celery, open source, sistemas distribuidos, o mueve ese slider a la derecha y descubre qué pasa, parce. *Despierta, Neo.*',
} as const;

/** Suggested questions shown as quick-action chips, one set per UI language. */
export const SUGGESTED_QUESTIONS = {
  en: [
    'Tell me about your work on Celery',
    'How does pytest-celery work under the hood?',
    'Compare Celery vs RQ in a table',
    'Roast yourself 🔥',
  ],
  es: [
    '¿Qué haces en el mundo open source?',
    'Cuéntame de Celery, parce',
    'Compara Celery vs RQ en una tabla',
    'Roast yourself 🔥',
  ],
} as const;
