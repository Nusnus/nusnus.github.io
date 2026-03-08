/**
 * Tool definitions for the xAI Responses API.
 *
 * Cybernus uses the full native tool stack: built-in web_search,
 * code_interpreter (Python sandbox), remote MCP servers (DeepWiki),
 * and custom function calls for UI actions (open_link, navigate).
 *
 * The Responses API returns tool calls as structured events in the
 * SSE stream — no text-marker parsing needed.
 */

import type { ToolAction } from './types';

/* ═══════════════════════════════════════════════════════════════════════
 *  Tool definitions — sent in the request `tools` array
 * ════════════════════════════════════════════��══════════════════════════ */

/**
 * xAI Responses API tool definition.
 *
 * Union covers every native tool type Cybernus uses:
 * - `web_search` — xAI's built-in live search
 * - `code_interpreter` — Python sandbox (OpenAI-compat naming)
 * - `mcp` — remote MCP server (Streaming HTTP / SSE transport only)
 * - `function` — custom client-side actions (flat schema, no nested key)
 */
export type ToolDefinition =
  | { type: 'web_search' }
  | { type: 'code_interpreter' }
  | {
      type: 'mcp';
      server_url: string;
      server_label: string;
      /** Optional allowlist — if omitted, all MCP server tools are available. */
      allowed_tool_names?: string[];
    }
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
 * Function tool definitions — client-side UI actions rendered as buttons.
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
 * DeepWiki MCP server — AI-indexed source code for the Celery ecosystem.
 *
 * No authentication required. Covers celery/celery, celery/kombu,
 * celery/pytest-celery, and all other public Celery org repos. xAI
 * connects to this server directly — the browser never touches it.
 *
 * @see https://deepwiki.com/celery/celery
 */
const DEEPWIKI_MCP: ToolDefinition = {
  type: 'mcp',
  server_url: 'https://mcp.deepwiki.com/mcp',
  server_label: 'deepwiki',
};

/**
 * Complete tool set for Cybernus.
 *
 * Order matters for the model's tool-selection heuristics: built-in
 * search first (cheapest, fastest), then code execution, then MCP,
 * then UI actions last (highest user-visible cost).
 */
export const CYBERNUS_TOOLS: readonly ToolDefinition[] = [
  { type: 'web_search' },
  { type: 'code_interpreter' },
  DEEPWIKI_MCP,
  ...FUNCTION_TOOLS,
];

/**
 * Legacy tool set — web_search + UI actions only.
 * Kept for RoastWidget compatibility (it doesn't need code exec or MCP).
 */
export const CLOUD_TOOLS: ToolDefinition[] = [{ type: 'web_search' }, ...FUNCTION_TOOLS];

/* ═══════════════════════════════════════════════════════════════════════
 *  Tool call → UI action mapping
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Map raw API tool_calls to UI-renderable ToolAction objects.
 * Safely parses arguments JSON and filters out invalid calls.
 * Server-side tool calls (web_search, code_interpreter, mcp) are silently skipped.
 */
export function mapToolCallsToActions(toolCalls: ToolCallResult[]): ToolAction[] {
  const actions: ToolAction[] = [];

  for (const call of toolCalls) {
    // Only open_link and navigate produce UI buttons
    if (call.name !== 'open_link' && call.name !== 'navigate') continue;

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
