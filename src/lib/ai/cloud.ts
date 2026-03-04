/**
 * Cloud AI client — sends chat completions to the Cloudflare Worker proxy.
 *
 * The proxy forwards requests to xAI (Grok) with the API key injected
 * server-side. This module is only used when the "Cloud" provider is selected.
 *
 * Supports:
 * - Non-streaming (cloudChat) and streaming (cloudChatStream)
 * - Native function calling via `tools` parameter
 * - Web search grounding via xAI's built-in search tool
 * - Structured outputs via `response_format` parameter
 */

import { CLOUD_PROXY_URL, CLOUD_GENERATION_CONFIG } from './config';
import type { ToolDefinition, ToolCallResult } from './tools';

export interface CloudMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Optional parameters for cloud chat requests. */
export interface CloudChatOptions {
  /** OpenAI-compatible tool definitions for function calling. */
  tools?: ToolDefinition[];
  /** Tool choice strategy: 'auto' lets the model decide. */
  tool_choice?: 'auto' | 'none' | 'required';
  /** Response format for structured outputs (e.g., JSON schema enforcement). */
  response_format?:
    | { type: 'text' | 'json_object' }
    | { type: 'json_schema'; json_schema: Record<string, unknown> };
}

interface CloudToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface CloudChoice {
  message: { content: string | null; tool_calls?: CloudToolCall[] };
  finish_reason: string;
}

interface CloudResponse {
  choices?: CloudChoice[];
  error?: { message: string };
}

/** Result from cloud chat containing both content and tool calls. */
export interface CloudChatResult {
  content: string;
  toolCalls: ToolCallResult[];
}

/**
 * Send a chat completion request to the cloud proxy (non-streaming).
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
    body: JSON.stringify({
      model: modelId,
      messages,
      stream: false,
      ...CLOUD_GENERATION_CONFIG,
      ...(options?.tools && { tools: options.tools }),
      ...(options?.tool_choice && { tool_choice: options.tool_choice }),
      ...(options?.response_format && { response_format: options.response_format }),
    }),
  });

  if (!response.ok) {
    let errorMessage = `Request failed (${response.status})`;
    try {
      const data = (await response.json()) as CloudResponse;
      if (data.error?.message) errorMessage = data.error.message;
    } catch {
      // Use default error message
    }
    throw new Error(errorMessage);
  }

  const data = (await response.json()) as CloudResponse;
  const choice = data.choices?.[0];

  if (!choice?.message?.content && !choice?.message?.tool_calls?.length) {
    throw new Error('Empty response from AI provider');
  }

  return {
    content: choice.message.content ?? '',
    toolCalls: (choice.message.tool_calls ?? []).map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: tc.function.arguments,
    })),
  };
}

/**
 * SSE streaming delta shape from OpenAI-compatible APIs.
 * Includes tool_calls support for native function calling.
 */
interface StreamDeltaToolCall {
  index: number;
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string };
}

interface StreamDelta {
  choices?: {
    delta?: { content?: string; tool_calls?: StreamDeltaToolCall[] };
    finish_reason?: string | null;
  }[];
}

/**
 * Send a streaming chat completion request to the cloud proxy.
 * Calls `onToken` for each delta chunk as it arrives.
 * Returns the full accumulated response text and any tool calls.
 *
 * Tool calls are accumulated from stream deltas — the model may return
 * both content AND tool_calls (e.g., text response + action buttons).
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
    body: JSON.stringify({
      model: modelId,
      messages,
      stream: true,
      ...CLOUD_GENERATION_CONFIG,
      ...(options?.tools && { tools: options.tools }),
      ...(options?.tool_choice && { tool_choice: options.tool_choice }),
      ...(options?.response_format && { response_format: options.response_format }),
    }),
    signal: signal ?? null,
  });

  if (!response.ok) {
    let errorMessage = `Request failed (${response.status})`;
    try {
      const text = await response.text();
      const data = JSON.parse(text) as CloudResponse;
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

  // Accumulate tool_calls from stream deltas (arguments arrive in chunks)
  const toolCallAccumulator = new Map<number, { id: string; name: string; arguments: string }>();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE lines
      const lines = buffer.split('\n');
      // Keep the last potentially incomplete line in the buffer
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue; // skip empty lines and comments
        if (trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const json = JSON.parse(trimmed.slice(6)) as StreamDelta;
          const delta = json.choices?.[0]?.delta;

          // Accumulate text content
          if (delta?.content) {
            accumulated += delta.content;
            onToken(delta.content, accumulated);
          }

          // Accumulate tool calls (chunked arguments)
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const existing = toolCallAccumulator.get(tc.index);
              if (existing) {
                existing.arguments += tc.function?.arguments ?? '';
              } else {
                toolCallAccumulator.set(tc.index, {
                  id: tc.id ?? '',
                  name: tc.function?.name ?? '',
                  arguments: tc.function?.arguments ?? '',
                });
              }
            }
          }
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
