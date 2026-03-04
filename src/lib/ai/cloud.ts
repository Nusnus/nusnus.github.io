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
  /** Tool definitions (web_search, function calls, etc.). */
  tools?: ToolDefinition[];
  /** Tool choice strategy: 'auto' lets the model decide. */
  tool_choice?: 'auto' | 'none' | 'required';
}

/** Result from cloud chat containing both content and tool calls. */
export interface CloudChatResult {
  content: string;
  toolCalls: ToolCallResult[];
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

        try {
          const raw = JSON.parse(trimmed.slice(6)) as Record<string, unknown>;
          const eventType = raw.type as string | undefined;

          if (eventType === 'response.output_text.delta') {
            const e = raw as unknown as StreamOutputTextDelta;
            accumulated += e.delta;
            onToken(e.delta, accumulated);
          } else if (eventType === 'response.output_item.added') {
            const e = raw as unknown as StreamOutputItemAdded;
            if (e.item.type === 'function_call') {
              toolCallAccumulator.set(e.output_index, {
                id: e.item.call_id ?? '',
                name: e.item.name ?? '',
                arguments: '',
              });
            }
          } else if (eventType === 'response.function_call_arguments.delta') {
            const e = raw as unknown as StreamFunctionCallArgsDelta;
            const existing = toolCallAccumulator.get(e.output_index);
            if (existing) existing.arguments += e.delta;
          }
          // All other events (response.created, response.in_progress,
          // response.completed, web_search_call.*, etc.) — skip
        } catch {
          // Skip malformed JSON chunks
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  const toolCalls = Array.from(toolCallAccumulator.values());

  if (!accumulated && toolCalls.length === 0) {
    throw new Error('Empty response from AI provider');
  }

  return { content: accumulated, toolCalls };
}
