/**
 * Cybernus AI Configuration — single model architecture.
 *
 * All inference runs through xAI Grok 4 via the Cloudflare Worker proxy.
 * Shared generation config, history trimming, and suggested questions
 * are canonical in `@lib/cybernus/config` and re-exported here.
 */

/* ─── Re-exports from canonical cybernus config ─── */

export {
  CLOUD_PROXY_URL,
  GENERATION_CONFIG as CLOUD_GENERATION_CONFIG,
  MAX_USER_MESSAGES,
  trimHistory,
  SUGGESTED_QUESTIONS,
} from '@lib/cybernus/config';

/* ─── Cloud Model Catalog (unique to this module) ─── */

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
