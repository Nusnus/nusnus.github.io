/**
 * Tool actions — native function calling for cloud models.
 *
 * Uses the xAI Responses API with native function calling and built-in
 * web search. The model returns structured tool calls in the response,
 * which are mapped to ToolAction objects for the UI.
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
 *  Action execution
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
