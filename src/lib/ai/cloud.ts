/**
 * Cloud AI client — sends requests to the Cloudflare Worker proxy,
 * which forwards to xAI's Responses API (Grok).
 *
 * The Responses API enables:
 * - Built-in web search (xAI searches the web autonomously)
 * - Native function calling for UI actions (open_link, navigate)
 * - Rich event-driven streaming (typed SSE events)
 *
 * This module is only used when the "Cloud" provider is selected.
 */

import { CLOUD_PROXY_URL, CLOUD_GENERATION_CONFIG } from './config';
import type { ToolDefinition, ToolCallResult } from './tools';

export interface CloudMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Optional parameters for cloud chat requests. */
export interface CloudChatOptions {
  /** Tool definitions (web_search, code_interpreter, mcp, function calls). */
  tools?: readonly ToolDefinition[];
  /** Tool choice strategy: 'auto' lets the model decide. */
  tool_choice?: 'auto' | 'none' | 'required';
  /** Called when the model triggers a web search (before content streams). */
  onWebSearch?: () => void;
  /** Called when a web search completes and the model starts synthesizing. */
  onWebSearchFound?: () => void;
  /**
   * Called when any server-side tool fires (code_interpreter, mcp, web_search).
   * Lets the UI show a live "running Python…" / "querying DeepWiki…" chip.
   * @param label Human-readable tool label ("Web search", "Python", "DeepWiki", …)
   * @param phase 'start' when the call begins, 'done' when it completes
   */
  onToolActivity?: (label: string, phase: 'start' | 'done') => void;
  /**
   * Called when Grok 4's reasoning token count updates (via usage snapshots
   * in `response.in_progress` / `response.completed` events). The actual
   * reasoning content is encrypted by xAI — only the count is exposed.
   */
  onReasoning?: (tokens: number) => void;
}

/** Result from cloud chat containing both content and tool calls. */
export interface CloudChatResult {
  content: string;
  toolCalls: ToolCallResult[];
  /** Final reasoning token count from `response.completed` usage. */
  reasoningTokens?: number;
}

/* ─── Responses API response shapes ─── */

interface ResponsesOutputText {
  type: 'output_text';
  text: string;
}

interface ResponsesMessageItem {
  type: 'message';
  content: ResponsesOutputText[];
}

interface ResponsesFunctionCallItem {
  type: 'function_call';
  name: string;
  arguments: string;
  call_id: string;
}

/** A web_search_call item — we skip these (server-side only). */
interface ResponsesWebSearchItem {
  type: 'web_search_call';
  [key: string]: unknown;
}

type ResponsesOutputItem =
  | ResponsesMessageItem
  | ResponsesFunctionCallItem
  | ResponsesWebSearchItem;

interface ResponsesAPIResponse {
  output?: ResponsesOutputItem[];
  error?: { message: string };
}

/**
 * Strip <grok:render>…</grok:render> blocks from accumulated text for live display.
 * Also hides any incomplete opening tag still being streamed.
 */
function stripGrokRenderForDisplay(text: string): string {
  let result = text.replace(/<grok:render[\s\S]*?<\/grok:render>/g, '');
  const incomplete = result.lastIndexOf('<grok:render');
  if (incomplete !== -1) result = result.slice(0, incomplete);
  return result.trimEnd();
}

/**
 * Extract complete <grok:render> blocks as ToolCallResults and return cleaned content.
 * Grok sometimes emits tool calls as XML in the text stream rather than structured events.
 */
function extractGrokRenderBlocks(text: string): { content: string; toolCalls: ToolCallResult[] } {
  const toolCalls: ToolCallResult[] = [];
  const blockRe = /<grok:render\s+type="([^"]+)">([\s\S]*?)<\/grok:render>/g;
  const argRe = /<argument\s+name="([^"]+)">([^<]*)<\/argument>/g;
  let m: RegExpExecArray | null;
  let id = 0;

  while ((m = blockRe.exec(text)) !== null) {
    const type = m[1] ?? '';
    const body = m[2] ?? '';
    const args: Record<string, string> = {};
    let a: RegExpExecArray | null;
    argRe.lastIndex = 0;
    while ((a = argRe.exec(body)) !== null) {
      args[a[1] ?? ''] = a[2] ?? '';
    }
    if (args.url) {
      toolCalls.push({
        id: `grok_render_${id++}`,
        name: type === 'navigate' ? 'navigate' : 'open_link',
        arguments: JSON.stringify(args),
      });
    }
  }

  return {
    content: text.replace(/<grok:render[\s\S]*?<\/grok:render>/g, '').trimEnd(),
    toolCalls,
  };
}

/** Build the request body for the xAI Responses API. */
function buildRequestBody(
  messages: CloudMessage[],
  modelId: string,
  stream: boolean,
  options?: CloudChatOptions,
): Record<string, unknown> {
  return {
    model: modelId,
    input: messages,
    stream,
    ...CLOUD_GENERATION_CONFIG,
    ...(options?.tools && { tools: options.tools }),
    ...(options?.tool_choice && { tool_choice: options.tool_choice }),
  };
}

/**
 * Send a request to the cloud proxy (non-streaming, Responses API).
 * Returns the assistant's response text and any tool calls.
 *
 * @throws Error if the proxy or upstream returns an error.
 */
export async function cloudChat(
  messages: CloudMessage[],
  modelId: string,
  options?: CloudChatOptions,
): Promise<CloudChatResult> {
  const response = await fetch(CLOUD_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildRequestBody(messages, modelId, false, options)),
  });

  if (!response.ok) {
    let errorMessage = `Request failed (${response.status})`;
    try {
      const data = (await response.json()) as ResponsesAPIResponse;
      if (data.error?.message) errorMessage = data.error.message;
    } catch {
      // Use default error message
    }
    throw new Error(errorMessage);
  }

  const data = (await response.json()) as ResponsesAPIResponse;
  return parseResponsesOutput(data.output ?? []);
}

/** Extract content and tool calls from Responses API output items. */
function parseResponsesOutput(output: ResponsesOutputItem[]): CloudChatResult {
  let content = '';
  const toolCalls: ToolCallResult[] = [];

  for (const item of output) {
    if (item.type === 'message') {
      for (const part of item.content) {
        if (part.type === 'output_text') content += part.text;
      }
    } else if (item.type === 'function_call') {
      toolCalls.push({
        id: item.call_id,
        name: item.name,
        arguments: item.arguments,
      });
    }
    // web_search_call items are server-side only — skip silently
  }

  if (!content && toolCalls.length === 0) {
    throw new Error('Empty response from AI provider');
  }

  return { content, toolCalls };
}

/* ─── Responses API streaming event types ─── */

interface StreamOutputTextDelta {
  type: 'response.output_text.delta';
  delta: string;
}

interface StreamOutputItemAdded {
  type: 'response.output_item.added';
  item: { type: string; name?: string; call_id?: string };
  output_index: number;
}

interface StreamFunctionCallArgsDelta {
  type: 'response.function_call_arguments.delta';
  delta: string;
  output_index: number;
}

interface StreamOutputItemDone {
  type: 'response.output_item.done';
  output_index: number;
  item: { type: string; [key: string]: unknown };
}

/** Usage snapshot from `response.in_progress` / `response.completed` events. */
interface StreamResponseUsage {
  output_tokens_details?: { reasoning_tokens?: number };
}

/** Map an output item `type` to a human-readable tool label for the UI. */
function labelForToolItem(itemType: string, serverLabel?: string): string | null {
  switch (itemType) {
    case 'web_search_call':
      return 'Web search';
    case 'code_interpreter_call':
      return 'Python';
    case 'mcp_call':
      return serverLabel ? `MCP · ${serverLabel}` : 'MCP';
    case 'mcp_list_tools':
      // MCP server handshake — not worth surfacing to the user
      return null;
    default:
      return null;
  }
}

/**
 * Send a streaming request to the cloud proxy (Responses API).
 * Calls `onToken` for each text delta as it arrives.
 * Returns the full accumulated response text and any tool calls.
 *
 * @throws Error if the proxy or upstream returns an error.
 */
export async function cloudChatStream(
  messages: CloudMessage[],
  modelId: string,
  onToken: (token: string, accumulated: string) => void,
  signal?: AbortSignal,
  options?: CloudChatOptions,
): Promise<CloudChatResult> {
  const response = await fetch(CLOUD_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildRequestBody(messages, modelId, true, options)),
    signal: signal ?? null,
  });

  if (!response.ok) {
    let errorMessage = `Request failed (${response.status})`;
    try {
      const text = await response.text();
      const data = JSON.parse(text) as ResponsesAPIResponse;
      if (data.error?.message) errorMessage = data.error.message;
    } catch {
      // Use default error message
    }
    throw new Error(errorMessage);
  }

  if (!response.body) {
    throw new Error('No response body for streaming');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = '';
  let buffer = '';

  // Accumulate function call tool_calls (arguments arrive in chunks)
  const toolCallAccumulator = new Map<number, { id: string; name: string; arguments: string }>();
  // Track server-side tool labels by output_index for matching start → done
  const activeToolLabels = new Map<number, string>();
  let reasoningTokens = 0;

  const reportUsage = (response: unknown): void => {
    const usage = (response as { usage?: StreamResponseUsage } | undefined)?.usage;
    const tokens = usage?.output_tokens_details?.reasoning_tokens;
    if (typeof tokens === 'number' && tokens !== reasoningTokens) {
      reasoningTokens = tokens;
      options?.onReasoning?.(tokens);
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE lines
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;
        if (!trimmed.startsWith('data: ')) continue;

        // Parse the JSON payload. This is the ONLY thing we guard with a
        // try/catch — if parsing fails, skip the chunk. Intentional throws
        // from `response.failed` / `response.incomplete` below must NOT be
        // swallowed here; they need to propagate to the caller.
        let raw: Record<string, unknown>;
        try {
          raw = JSON.parse(trimmed.slice(6)) as Record<string, unknown>;
        } catch {
          continue; // malformed JSON chunk — skip
        }
        const eventType = raw.type as string | undefined;

        if (eventType === 'response.output_text.delta') {
          const e = raw as unknown as StreamOutputTextDelta;
          accumulated += e.delta;
          onToken(e.delta, stripGrokRenderForDisplay(accumulated));
        } else if (eventType === 'response.output_item.added') {
          const e = raw as unknown as StreamOutputItemAdded;
          if (e.item.type === 'function_call') {
            toolCallAccumulator.set(e.output_index, {
              id: e.item.call_id ?? '',
              name: e.item.name ?? '',
              arguments: '',
            });
          } else {
            // Server-side tool (web_search, code_interpreter, mcp) — surface to UI
            const serverLabel = (e.item as { server_label?: string }).server_label;
            const label = labelForToolItem(e.item.type, serverLabel);
            if (label) {
              activeToolLabels.set(e.output_index, label);
              options?.onToolActivity?.(label, 'start');
            }
            // Legacy callback for RoastWidget compat
            if (e.item.type === 'web_search_call') options?.onWebSearch?.();
          }
        } else if (eventType === 'response.function_call_arguments.delta') {
          const e = raw as unknown as StreamFunctionCallArgsDelta;
          const existing = toolCallAccumulator.get(e.output_index);
          if (existing) existing.arguments += e.delta;
        } else if (eventType === 'response.output_item.done') {
          const e = raw as unknown as StreamOutputItemDone;
          const label = activeToolLabels.get(e.output_index);
          if (label) {
            activeToolLabels.delete(e.output_index);
            options?.onToolActivity?.(label, 'done');
          }
          // Legacy callback for RoastWidget compat
          if (e.item.type === 'web_search_call') options?.onWebSearchFound?.();
        } else if (eventType === 'response.in_progress' || eventType === 'response.completed') {
          // Grok 4 streams usage snapshots on these events — extract reasoning_tokens
          reportUsage((raw as { response?: unknown }).response);
        } else if (eventType === 'response.failed') {
          const err = (raw as Record<string, unknown>).response as
            | { error?: { message?: string } }
            | undefined;
          throw new Error(err?.error?.message ?? 'Response failed');
        } else if (eventType === 'response.incomplete') {
          // The model stopped before finishing — surface a useful message
          const reason = (
            (raw as Record<string, unknown>).response as
              | { incomplete_details?: { reason?: string } }
              | undefined
          )?.incomplete_details?.reason;
          if (!accumulated) {
            throw new Error(reason ? `Incomplete response: ${reason}` : 'Incomplete response');
          }
        }
        // All other events (response.created, etc.) — skip
      }
    }
  } finally {
    reader.releaseLock();
  }

  const structuredToolCalls = Array.from(toolCallAccumulator.values());

  // Grok sometimes emits tool calls as <grok:render> XML in the text stream —
  // extract them and strip from the visible content.
  const { content, toolCalls: renderToolCalls } = extractGrokRenderBlocks(accumulated);
  const toolCalls = [...structuredToolCalls, ...renderToolCalls];

  if (!content && toolCalls.length === 0) {
    throw new Error('Empty response from AI provider');
  }

  return {
    content,
    toolCalls,
    ...(reasoningTokens > 0 && { reasoningTokens }),
  };
}
