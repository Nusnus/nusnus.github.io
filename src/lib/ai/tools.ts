/**
 * Tool actions — native function calling + MCP tools for cloud models (Grok).
 *
 * Uses the xAI Responses API with native function calling, built-in
 * web search, X search, code execution, and remote MCP tools (DeepWiki).
 * The model returns structured tool calls in the response,
 * which are mapped to ToolAction objects for the UI.
 */

import type { ToolAction } from './types';
import { buildToolDefinitions, loadTools } from '@lib/cybernus/services/AgentService';

/* ─── xAI Responses API tool definitions ─── */

/**
 * Tool definition for the xAI Responses API.
 * Supports built-in tools, function tools, and remote MCP tools.
 */
export type ToolDefinition = Record<string, unknown>;

/** Raw tool call as returned by the xAI Responses API. */
export interface ToolCallResult {
  id: string;
  name: string;
  arguments: string; // JSON string
}

/**
 * Returns the tool definitions for the current session.
 * Uses the AgentService to build definitions from enabled tools.
 */
export function getToolsForModel(_modelId: string): ToolDefinition[] {
  const tools = loadTools();
  return buildToolDefinitions(tools);
}

/**
 * Map raw API tool_calls to UI-renderable ToolAction objects.
 * Safely parses arguments JSON and filters out invalid calls.
 * Server-side tool calls (e.g., web_search, mcp) are silently skipped.
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
