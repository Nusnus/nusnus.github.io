/**
 * Tool actions — native function calling for cloud models + text marker
 * fallback for local models.
 *
 * Cloud (Grok): Uses the xAI Responses API with native function calling
 * and built-in web search. The model returns structured tool calls in
 * the response, which are mapped to ToolAction objects for the UI.
 *
 * Local (WebLLM): Uses text markers ([LINK: ...], [NAV: ...]) parsed
 * with regex, since local models don't support function calling.
 */

import type { ToolAction } from './types';

/* ═══════════════════════════════════════════════════════════════════════
 *  CLOUD — xAI Responses API tool definitions
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Tool definition for the xAI Responses API.
 * Built-in tools use `type: "web_search"`.
 * Custom functions use `type: "function"` with flat name/description/parameters.
 */
export type ToolDefinition =
  | { type: 'web_search' }
  | {
      type: 'function';
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };

/** Raw tool call as returned by the xAI Responses API. */
export interface ToolCallResult {
  id: string;
  name: string;
  arguments: string; // JSON string
}

/**
 * Function tool definitions sent to the xAI Responses API.
 * Uses the flat format required by the Responses API (no nested `function` key).
 */
const FUNCTION_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    name: 'open_link',
    description:
      'Suggest opening an external link relevant to the conversation. Use when referencing a specific URL from the knowledge base (e.g., GitHub repos, LinkedIn, articles). Maximum 2 calls per response.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The full URL to open (must be from the knowledge base, do not invent URLs)',
        },
        label: {
          type: 'string',
          description: 'Short button label describing the link (e.g., "View Celery on GitHub")',
        },
      },
      required: ['url', 'label'],
    },
  },
  {
    type: 'function',
    name: 'navigate',
    description:
      'Suggest navigating to a page on this website. Use when directing the user to a section of the portfolio site. Maximum 2 calls per response.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The site path to navigate to (e.g., "/", "/chat")',
        },
        label: {
          type: 'string',
          description: 'Short button label (e.g., "Back to Portfolio")',
        },
      },
      required: ['url', 'label'],
    },
  },
];

/**
 * Complete tool set for cloud requests.
 * Includes xAI's built-in web search + client-side action tools.
 */
export const CLOUD_TOOLS: ToolDefinition[] = [{ type: 'web_search' }, ...FUNCTION_TOOLS];

/**
 * Map raw API tool_calls to UI-renderable ToolAction objects.
 * Safely parses arguments JSON and filters out invalid calls.
 * Server-side tool calls (e.g., web_search) are silently skipped.
 */
export function mapToolCallsToActions(toolCalls: ToolCallResult[]): ToolAction[] {
  const actions: ToolAction[] = [];

  for (const call of toolCalls) {
    try {
      const args = JSON.parse(call.arguments) as { url?: string; label?: string };
      if (!args.url) continue;

      actions.push({
        type: call.name === 'navigate' ? 'navigate' : 'open_link',
        label: args.label ?? args.url,
        url: args.url,
      });
    } catch {
      // Skip malformed tool call arguments
    }
  }

  return actions;
}

/* ═══════════════════════════════════════════════════════════════════════
 *  LOCAL — Text marker parsing for WebLLM models (no function calling)
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Pattern matching action markers in local model responses.
 * Matches: [LINK: url | label] and [NAV: path | label]
 */
const ACTION_PATTERN = /\[(LINK|NAV):\s*([^\]|]+?)(?:\s*\|\s*([^\]]+?))?\s*\]/g;

/** Result of parsing a local model response for text-marker actions. */
export interface ParsedResponse {
  /** The response text with action markers removed. */
  text: string;
  /** Extracted actions to render as buttons. */
  actions: ToolAction[];
}

/**
 * Parse a local model response for text-marker actions.
 * Returns the cleaned text and any extracted actions.
 * Only used for local (WebLLM) models — cloud uses native tool_calls.
 */
export function parseActions(response: string): ParsedResponse {
  const actions: ToolAction[] = [];

  const text = response.replace(ACTION_PATTERN, (_, type: string, url: string, label?: string) => {
    const trimmedUrl = url.trim();
    const trimmedLabel = label?.trim() || trimmedUrl;

    actions.push({
      type: type === 'NAV' ? 'navigate' : 'open_link',
      label: trimmedLabel,
      url: trimmedUrl,
    });

    return ''; // Remove the marker from display text
  });

  return { text: text.trimEnd(), actions };
}

/* ═══════════════════════════════════════════════════════════════════════
 *  SHARED — Action execution (used by both cloud and local)
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Execute a tool action.
 * Navigation opens in the same tab; external links open in a new tab.
 */
export function executeAction(action: ToolAction): void {
  if (action.type === 'navigate') {
    window.location.href = action.url;
  } else {
    window.open(action.url, '_blank', 'noopener,noreferrer');
  }
}

/**
 * System prompt section for LOCAL models that instructs the model how to
 * use text-marker actions. Not used by cloud models (they use native tools).
 */
export const LOCAL_TOOLS_PROMPT_SECTION = `
# Available Actions
When your answer references a specific link, page, or project, include action markers at the END of your response (after your text). Only include actions that are directly relevant.

Format:
[LINK: url | label]  — Suggest opening an external link
[NAV: path | label]  — Suggest navigating to a page on this site

Examples:
[LINK: https://github.com/celery/celery | View Celery on GitHub]
[LINK: https://www.linkedin.com/in/tomernosrati | Tomer's LinkedIn]
[NAV: / | Back to Portfolio]

Rules:
- Only include actions for URLs mentioned in your knowledge base
- Maximum 2 actions per response
- Always place actions at the very end, after your text
- Do not invent URLs — only use URLs from the provided data`;
