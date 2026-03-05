/**
 * Cloud AI client — xAI Responses API via the Cloudflare Worker proxy.
 *
 * Single-model, single-path. Streams SSE events, surfaces reasoning-token
 * progress so the UI can show a live "thinking" state, and tracks
 * server-side tool invocations (web_search, MCP, code_execution) so the
 * bubble can show what Cybernus is doing before text arrives.
 */

import { CLOUD_PROXY_URL, GENERATION_CONFIG, CYBERNUS_MODEL_ID } from './config';
import type { ToolDefinition, ToolCallResult } from './tools';

export interface CloudMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Optional parameters for cloud chat requests. */
export interface CloudChatOptions {
  tools?: ToolDefinition[];
  tool_choice?: 'auto' | 'none' | 'required';
  /** Temperature override (spectrum-driven). */
  temperature?: number;
  /** Called when the model begins reasoning (before any text). */
  onThinking?: (reasoningTokens: number) => void;
  /** Called when the model triggers a web search. */
  onWebSearch?: () => void;
  /** Called when the model triggers an MCP tool (DeepWiki / Context7). */
  onMcpCall?: (serverLabel: string) => void;
  /** Called when the model triggers code execution. */
  onCodeExec?: () => void;
  /** Called when any server-side tool completes. */
  onToolDone?: () => void;
}

/** Result from cloud chat containing both content and tool calls. */
export interface CloudChatResult {
  content: string;
  toolCalls: ToolCallResult[];
  reasoningTokens: number;
}

/* ─── Responses API response shapes (non-streaming) ─── */

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
interface ResponsesToolItem {
  type: 'web_search_call' | 'code_interpreter_call' | 'mcp_call' | 'mcp_list_tools';
  [key: string]: unknown;
}
type ResponsesOutputItem = ResponsesMessageItem | ResponsesFunctionCallItem | ResponsesToolItem;
interface ResponsesAPIResponse {
  output?: ResponsesOutputItem[];
  usage?: { output_tokens_details?: { reasoning_tokens?: number } };
  error?: { message: string };
}

/* ─── Helpers ─── */

/** Strip <grok:render>…</grok:render> blocks from accumulated text for live display. */
function stripGrokRenderForDisplay(text: string): string {
  let result = text.replace(/<grok:render[\s\S]*?<\/grok:render>/g, '');
  const incomplete = result.lastIndexOf('<grok:render');
  if (incomplete !== -1) result = result.slice(0, incomplete);
  return result.trimEnd();
}

/** Extract complete <grok:render> blocks as ToolCallResults and return cleaned content. */
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
    while ((a = argRe.exec(body)) !== null) args[a[1] ?? ''] = a[2] ?? '';
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
  stream: boolean,
  options?: CloudChatOptions,
): Record<string, unknown> {
  return {
    model: CYBERNUS_MODEL_ID,
    input: messages,
    stream,
    temperature: options?.temperature ?? 0.7,
    ...GENERATION_CONFIG,
    ...(options?.tools && { tools: options.tools }),
    ...(options?.tool_choice && { tool_choice: options.tool_choice }),
  };
}

/* ═══════════════════════════════════════════════════════════════════════
 *  Non-streaming (used by RoastWidget)
 * ═══════════════════════════════════════════════════════════════════════ */

export async function cloudChat(
  messages: CloudMessage[],
  options?: CloudChatOptions,
): Promise<CloudChatResult> {
  const response = await fetch(CLOUD_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildRequestBody(messages, false, options)),
  });
  if (!response.ok) {
    let msg = `Request failed (${response.status})`;
    try {
      const data = (await response.json()) as ResponsesAPIResponse;
      if (data.error?.message) msg = data.error.message;
    } catch {
      /* use default */
    }
    throw new Error(msg);
  }
  const data = (await response.json()) as ResponsesAPIResponse;
  return parseResponsesOutput(data);
}

function parseResponsesOutput(data: ResponsesAPIResponse): CloudChatResult {
  let content = '';
  const toolCalls: ToolCallResult[] = [];
  for (const item of data.output ?? []) {
    if (item.type === 'message') {
      for (const part of item.content) if (part.type === 'output_text') content += part.text;
    } else if (item.type === 'function_call') {
      toolCalls.push({ id: item.call_id, name: item.name, arguments: item.arguments });
    }
  }
  if (!content && toolCalls.length === 0) throw new Error('Empty response from AI provider');
  return {
    content,
    toolCalls,
    reasoningTokens: data.usage?.output_tokens_details?.reasoning_tokens ?? 0,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
 *  Streaming
 * ═══════════════════════════════════════════════════════════════════════ */

/* SSE event shapes (only the fields we use). */
interface StreamOutputTextDelta {
  type: 'response.output_text.delta';
  delta: string;
}
interface StreamOutputItemAdded {
  type: 'response.output_item.added';
  item: { type: string; name?: string; call_id?: string; server_label?: string };
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
interface StreamInProgress {
  type: 'response.in_progress';
  response?: { usage?: { output_tokens_details?: { reasoning_tokens?: number } } };
}

/**
 * Streaming chat. Calls `onToken` for each text delta and the various
 * `on*` callbacks as server-side tools fire. Returns the final result.
 */
export async function cloudChatStream(
  messages: CloudMessage[],
  onToken: (token: string, accumulated: string) => void,
  signal?: AbortSignal,
  options?: CloudChatOptions,
): Promise<CloudChatResult> {
  const response = await fetch(CLOUD_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildRequestBody(messages, true, options)),
    signal: signal ?? null,
  });

  if (!response.ok) {
    let msg = `Request failed (${response.status})`;
    try {
      const text = await response.text();
      const data = JSON.parse(text) as ResponsesAPIResponse;
      if (data.error?.message) msg = data.error.message;
    } catch {
      /* use default */
    }
    throw new Error(msg);
  }
  if (!response.body) throw new Error('No response body for streaming');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = '';
  let buffer = '';
  let reasoningTokens = 0;
  let hasText = false;

  const toolCallAccumulator = new Map<number, { id: string; name: string; arguments: string }>();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':') || !trimmed.startsWith('data: ')) continue;

        let raw: Record<string, unknown>;
        try {
          raw = JSON.parse(trimmed.slice(6)) as Record<string, unknown>;
        } catch {
          continue;
        }
        const type = raw.type as string | undefined;

        if (type === 'response.output_text.delta') {
          const e = raw as unknown as StreamOutputTextDelta;
          accumulated += e.delta;
          hasText = true;
          onToken(e.delta, stripGrokRenderForDisplay(accumulated));
        } else if (type === 'response.output_item.added') {
          const e = raw as unknown as StreamOutputItemAdded;
          const itemType = e.item.type;
          if (itemType === 'function_call') {
            toolCallAccumulator.set(e.output_index, {
              id: e.item.call_id ?? '',
              name: e.item.name ?? '',
              arguments: '',
            });
          } else if (itemType === 'web_search_call') {
            options?.onWebSearch?.();
          } else if (itemType === 'mcp_call' || itemType === 'mcp_list_tools') {
            options?.onMcpCall?.(e.item.server_label ?? 'mcp');
          } else if (itemType === 'code_interpreter_call') {
            options?.onCodeExec?.();
          } else if (itemType === 'reasoning') {
            // Reasoning item added — model is thinking before text arrives
            if (!hasText) options?.onThinking?.(reasoningTokens);
          }
        } else if (type === 'response.function_call_arguments.delta') {
          const e = raw as unknown as StreamFunctionCallArgsDelta;
          const existing = toolCallAccumulator.get(e.output_index);
          if (existing) existing.arguments += e.delta;
        } else if (type === 'response.output_item.done') {
          const e = raw as unknown as StreamOutputItemDone;
          const t = e.item.type;
          if (
            t === 'web_search_call' ||
            t === 'mcp_call' ||
            t === 'mcp_list_tools' ||
            t === 'code_interpreter_call'
          ) {
            options?.onToolDone?.();
          }
        } else if (
          type === 'response.reasoning_summary_text.delta' ||
          type === 'response.reasoning.delta'
        ) {
          // Reasoning deltas don't expose content (encrypted) but signal activity
          reasoningTokens += 1;
          if (!hasText) options?.onThinking?.(reasoningTokens);
        } else if (type === 'response.in_progress') {
          const e = raw as unknown as StreamInProgress;
          const rt = e.response?.usage?.output_tokens_details?.reasoning_tokens;
          if (typeof rt === 'number' && rt > reasoningTokens) {
            reasoningTokens = rt;
            if (!hasText) options?.onThinking?.(reasoningTokens);
          }
        } else if (type === 'response.completed') {
          const usage = (raw.response as Record<string, unknown> | undefined)?.usage as
            | { output_tokens_details?: { reasoning_tokens?: number } }
            | undefined;
          if (usage?.output_tokens_details?.reasoning_tokens) {
            reasoningTokens = usage.output_tokens_details.reasoning_tokens;
          }
        } else if (type === 'response.failed') {
          const err = (raw.response as { error?: { message?: string } } | undefined)?.error;
          throw new Error(err?.message ?? 'Response failed');
        } else if (type === 'response.incomplete') {
          const reason = (raw.response as { incomplete_details?: { reason?: string } } | undefined)
            ?.incomplete_details?.reason;
          if (!accumulated) {
            throw new Error(reason ? `Incomplete response: ${reason}` : 'Incomplete response');
          }
        }
        // response.created / etc. — ignore
      }
    }
  } finally {
    reader.releaseLock();
  }

  const structuredToolCalls = Array.from(toolCallAccumulator.values());
  const { content, toolCalls: renderToolCalls } = extractGrokRenderBlocks(accumulated);
  const toolCalls = [...structuredToolCalls, ...renderToolCalls];

  if (!content && toolCalls.length === 0) throw new Error('Empty response from AI provider');

  return { content, toolCalls, reasoningTokens };
}
