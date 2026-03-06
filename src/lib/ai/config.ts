/**
 * AI Chatbot Configuration
 *
 * Cloud model configuration and generation settings for the Grok-powered AI chatbot.
 */

/* ─── Cloud Model Configuration ─── */

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

/** Generation parameters for cloud models (large context, Responses API). */
export const CLOUD_GENERATION_CONFIG = {
  temperature: 0.85,
  top_p: 0.9,
  max_output_tokens: 1024,
} as const;

/** Suggested questions shown as quick-action chips. */
export const SUGGESTED_QUESTIONS = [
  'What are your main open source contributions?',
  'Tell me about the Celery project',
  'What is pytest-celery?',
  'Roast yourself 🔥',
] as const;

/** Greeting shown when the chat engine is ready. */
export const WELCOME_MESSAGE =
  "Hey — I'm **Tomer** (well, my digital self). Open source empire, Celery ecosystem, tech stack, or just want me to roast myself — ask away.";
