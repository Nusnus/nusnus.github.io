/**
 * Tool actions — native function calling for Grok 4 with MCP capabilities.
 *
 * Uses the xAI Responses API with native function calling and built-in
 * web search. Includes pre-installed MCP-style tools for enhanced
 * agent capabilities.
 */

import type { ToolAction } from './types';

/* ─── xAI Responses API tool definitions ─── */

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
 * MCP-style function tool definitions sent to the xAI Responses API.
 * These give Cybernus agent-like capabilities within the chat.
 */
const FUNCTION_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    name: 'open_link',
    description:
      'Suggest opening an external link relevant to the conversation. Use when referencing a specific URL from the knowledge base (e.g., GitHub repos, LinkedIn, articles). Maximum 3 calls per response.',
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
      'Navigate to a page on this website. Use when directing the user to a section of the portfolio site or the Cybernus chat. Maximum 2 calls per response.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The site path to navigate to (e.g., "/", "/cybernus")',
        },
        label: {
          type: 'string',
          description: 'Short button label (e.g., "Back to Portfolio")',
        },
      },
      required: ['url', 'label'],
    },
  },
  {
    type: 'function',
    name: 'show_github_stats',
    description:
      'Display a rich GitHub statistics card showing contribution data, repo stars, and activity metrics. Use when the user asks about GitHub stats, contributions, or activity overview.',
    parameters: {
      type: 'object',
      properties: {
        stat_type: {
          type: 'string',
          enum: ['contributions', 'repos', 'activity', 'overview'],
          description: 'Type of GitHub statistics to display',
        },
      },
      required: ['stat_type'],
    },
  },
  {
    type: 'function',
    name: 'show_project_card',
    description:
      'Display a rich project showcase card for a specific repository. Use when discussing a particular project in detail.',
    parameters: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Repository full name (e.g., "celery/celery", "celery/pytest-celery")',
        },
      },
      required: ['repo'],
    },
  },
  {
    type: 'function',
    name: 'show_timeline',
    description:
      'Display a visual timeline of career milestones or project history. Use when discussing career progression or project evolution.',
    parameters: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description:
            'Topic for the timeline (e.g., "career", "celery-releases", "contributions")',
        },
      },
      required: ['topic'],
    },
  },
];

/**
 * Complete tool set for Grok 4 requests.
 * Includes xAI's built-in web search + MCP-style action tools.
 */
export const CLOUD_TOOLS: ToolDefinition[] = [{ type: 'web_search' }, ...FUNCTION_TOOLS];

/** Returns the tool set for Grok 4. */
export function getToolsForModel(_modelId: string): ToolDefinition[] {
  return CLOUD_TOOLS;
}

/**
 * Map raw API tool_calls to UI-renderable ToolAction objects.
 * Safely parses arguments JSON and filters out invalid calls.
 * Server-side tool calls (e.g., web_search) are silently skipped.
 */
export function mapToolCallsToActions(toolCalls: ToolCallResult[]): ToolAction[] {
  const actions: ToolAction[] = [];

  for (const call of toolCalls) {
    try {
      const args = JSON.parse(call.arguments) as Record<string, string | undefined>;

      if (call.name === 'open_link' || call.name === 'navigate') {
        if (!args.url) continue;
        actions.push({
          type: call.name === 'navigate' ? 'navigate' : 'open_link',
          label: args.label ?? args.url,
          url: args.url,
        });
      } else if (call.name === 'show_github_stats') {
        actions.push({
          type: 'render_component',
          componentType: 'github_stats',
          props: { statType: args.stat_type ?? 'overview' },
          label: 'GitHub Stats',
          url: '',
        });
      } else if (call.name === 'show_project_card') {
        actions.push({
          type: 'render_component',
          componentType: 'project_card',
          props: { repo: args.repo ?? '' },
          label: args.repo ?? 'Project',
          url: '',
        });
      } else if (call.name === 'show_timeline') {
        actions.push({
          type: 'render_component',
          componentType: 'timeline',
          props: { topic: args.topic ?? '' },
          label: 'Timeline',
          url: '',
        });
      }
    } catch {
      // Skip malformed tool call arguments
    }
  }

  return actions;
}

/**
 * Execute a tool action.
 * Navigation opens in the same tab; external links open in a new tab.
 * Render components are handled by the chat message renderer.
 */
export function executeAction(action: ToolAction): void {
  if (action.type === 'navigate') {
    window.location.href = action.url;
  } else if (action.type === 'open_link') {
    window.open(action.url, '_blank', 'noopener,noreferrer');
  }
  // render_component actions are handled by the UI renderer
}
