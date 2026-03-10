/**
 * AgentService — MCP tool orchestration for Cybernus.
 *
 * Manages built-in xAI tools (web_search, x_search, code_execution)
 * and remote MCP tools (DeepWiki). Provides tool definitions for the
 * Responses API and tracks tool invocations.
 */

import type { AgentTool, AgentToolCall } from '../types';

const STORAGE_KEY = 'cybernus-agent-tools';

/** Default agent tools — pre-configured for Cybernus. */
const DEFAULT_TOOLS: AgentTool[] = [
  {
    id: 'web_search',
    name: 'Web Search',
    description: 'Search the internet for information not in context',
    type: 'builtin',
    enabled: true,
    icon: 'globe',
  },
  {
    id: 'x_search',
    name: 'X Search',
    description: "Search X/Twitter posts — find Tomer's tweets and tech discussions",
    type: 'builtin',
    enabled: true,
    icon: 'twitter',
  },
  {
    id: 'code_execution',
    name: 'Code Execution',
    description: 'Run Python code in a sandbox for calculations and demos',
    type: 'builtin',
    enabled: true,
    icon: 'code',
  },
  {
    id: 'deepwiki',
    name: 'DeepWiki',
    description: 'Query GitHub repo documentation — perfect for Celery architecture deep dives',
    type: 'mcp',
    enabled: true,
    serverUrl: 'https://mcp.deepwiki.com/mcp',
    serverLabel: 'deepwiki',
    icon: 'book',
  },
];

/** Load tool configuration from localStorage, falling back to defaults. */
export function loadTools(): AgentTool[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AgentTool[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Merge with defaults to pick up any new tools
        const storedIds = new Set(parsed.map((t) => t.id));
        const newTools = DEFAULT_TOOLS.filter((t) => !storedIds.has(t.id));
        return [...parsed, ...newTools];
      }
    }
  } catch {
    // Fall through to defaults
  }
  return DEFAULT_TOOLS.map((t) => ({ ...t }));
}

/** Persist tool enable/disable state. */
export function saveTools(tools: AgentTool[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tools));
  } catch {
    // Silently ignore
  }
}

/** Toggle a specific tool on/off. */
export function toggleTool(toolId: string, enabled: boolean): AgentTool[] {
  const tools = loadTools();
  const tool = tools.find((t) => t.id === toolId);
  if (tool) tool.enabled = enabled;
  saveTools(tools);
  return tools;
}

/**
 * Build xAI Responses API tool definitions from enabled agent tools.
 * Returns the tools array to include in the API request.
 */
export function buildToolDefinitions(tools: AgentTool[]): Record<string, unknown>[] {
  const definitions: Record<string, unknown>[] = [];

  for (const tool of tools) {
    if (!tool.enabled) continue;

    if (tool.type === 'builtin') {
      if (tool.id === 'web_search') {
        definitions.push({ type: 'web_search' });
      } else if (tool.id === 'x_search') {
        definitions.push({ type: 'x_search' });
      } else if (tool.id === 'code_execution') {
        definitions.push({ type: 'code_execution' });
      }
    } else if (tool.type === 'mcp' && tool.serverUrl) {
      definitions.push({
        type: 'mcp',
        server_url: tool.serverUrl,
        server_label: tool.serverLabel ?? tool.name.toLowerCase(),
      });
    }
  }

  // Always include the client-side function tools
  definitions.push(
    {
      type: 'function',
      name: 'open_link',
      description:
        'Suggest opening an external link relevant to the conversation. Use when referencing a specific URL from the knowledge base. Maximum 2 calls per response.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description:
              'The full URL to open (must be from the knowledge base, do not invent URLs)',
          },
          label: {
            type: 'string',
            description: 'Short button label describing the link',
          },
        },
        required: ['url', 'label'],
      },
    },
    {
      type: 'function',
      name: 'navigate',
      description:
        'Suggest navigating to a page on this website. Use when directing the user to a section of the site.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The site path to navigate to (e.g., "/", "/cybernus")',
          },
          label: {
            type: 'string',
            description: 'Short button label',
          },
        },
        required: ['url', 'label'],
      },
    },
  );

  return definitions;
}

/** Create a tool call record for tracking. */
export function createToolCall(
  id: string,
  toolName: string,
  args: string,
  serverLabel?: string,
): AgentToolCall {
  return {
    id,
    toolName,
    ...(serverLabel !== undefined ? { serverLabel } : {}),
    arguments: args,
    status: 'pending',
    timestamp: Date.now(),
  };
}

/** Map raw API tool calls to ToolAction objects for the UI. */
export function mapToolCallsToActions(
  toolCalls: { id: string; name: string; arguments: string }[],
): { type: 'navigate' | 'open_link'; label: string; url: string }[] {
  const actions: { type: 'navigate' | 'open_link'; label: string; url: string }[] = [];

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

/** Execute a tool action. */
export function executeAction(action: { type: string; url: string }): void {
  if (action.type === 'navigate') {
    window.location.href = action.url;
  } else {
    window.open(action.url, '_blank', 'noopener,noreferrer');
  }
}
