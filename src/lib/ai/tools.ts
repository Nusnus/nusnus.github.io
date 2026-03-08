/**
 * Tool definitions for the xAI Responses API.
 *
 * Cybernus ships with five tool types:
 *   1. web_search        — xAI's built-in live web search
 *   2. code_execution    — xAI's sandboxed Python (read-only analysis only)
 *   3. mcp (DeepWiki)    — deep-read any public GitHub repo
 *   4. mcp (Context7)    — up-to-date library documentation
 *   5. function (open_link / navigate) — client-side UI actions
 *
 * MCP servers run remotely — xAI connects to them on our behalf. No local
 * infra required. We restrict DeepWiki to Tomer's public repo allowlist via
 * the system prompt; Context7 is naturally scoped to library docs.
 */

import type { ToolAction } from './types';
import { CELERY_REPOS, CELERY_ORG_REPOS } from '../../../shared/github-config';

/* ═══════════════════════════════════════════════════════════════════════
 *  Tool definitions — xAI Responses API
 * ═══════════════════════════════════════════════════════════════════════ */

/** Tool definition shape accepted by the xAI Responses API. */
export type ToolDefinition =
  | { type: 'web_search' }
  | { type: 'code_execution' }
  | {
      type: 'mcp';
      server_url: string;
      server_label: string;
      server_description?: string;
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

/** The full list of public repos Cybernus is allowed to deep-dive. */
export const ALLOWED_REPOS: readonly string[] = [
  ...CELERY_REPOS,
  ...CELERY_ORG_REPOS,
  'Nusnus/Nusnus',
  'Nusnus/nusnus.github.io',
];

/** Client-side action tools (rendered as buttons under the message). */
const FUNCTION_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    name: 'open_link',
    description:
      'Suggest opening an external link relevant to the conversation. Use when referencing a specific URL from the knowledge base (GitHub repos, LinkedIn, articles). Maximum 2 calls per response.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description:
            'The full URL to open (must be from the knowledge base — do not invent URLs)',
        },
        label: {
          type: 'string',
          description: 'Short button label describing the link (e.g. "View Celery on GitHub")',
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
          description: 'The site path to navigate to (e.g. "/", "/chat")',
        },
        label: {
          type: 'string',
          description: 'Short button label (e.g. "Back to Portfolio")',
        },
      },
      required: ['url', 'label'],
    },
  },
];

/**
 * Complete tool set sent with every request.
 *
 * Order matters for the model's internal priority — we put web_search first
 * (fast, cheap, general), then MCP (slower but deeper), then code_execution
 * (expensive), then UI actions.
 */
export const CLOUD_TOOLS: ToolDefinition[] = [
  { type: 'web_search' },
  {
    type: 'mcp',
    server_url: 'https://mcp.deepwiki.com/mcp',
    server_label: 'deepwiki',
    server_description:
      "Deep-read public GitHub repositories. Use ONLY for repos in Tomer's domain: " +
      ALLOWED_REPOS.join(', ') +
      '. Refuse any request to read repos outside this list.',
  },
  {
    type: 'mcp',
    server_url: 'https://mcp.context7.com/mcp',
    server_label: 'context7',
    server_description:
      'Up-to-date documentation for Python libraries, frameworks, and tools. Use when the question needs current API docs (e.g. Celery, pytest, RabbitMQ, Redis clients).',
  },
  { type: 'code_execution' },
  ...FUNCTION_TOOLS,
];

/* ═══════════════════════════════════════════════════════════════════════
 *  Tool call → UI action mapping
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Map raw API tool_calls to UI-renderable ToolAction objects.
 * Only open_link / navigate become buttons; everything else is server-side.
 */
export function mapToolCallsToActions(toolCalls: ToolCallResult[]): ToolAction[] {
  const actions: ToolAction[] = [];
  for (const call of toolCalls) {
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
      /* malformed — skip */
    }
  }
  return actions;
}

/** Execute a tool action (open link or navigate in-site). */
export function executeAction(action: ToolAction): void {
  if (action.type === 'navigate') {
    window.location.href = action.url;
  } else {
    window.open(action.url, '_blank', 'noopener,noreferrer');
  }
}
