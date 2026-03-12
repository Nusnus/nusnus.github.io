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

/** Worker base URL for non-responses endpoints. */
const WORKER_BASE_URL = CLOUD_PROXY_URL.replace('/v1/responses', '');

/** A single content part in a multimodal message. */
export interface TextContentPart {
  type: 'input_text';
  text: string;
}

export interface ImageContentPart {
  type: 'input_image';
  image_url: string;
  /** Resolution hint — 'high' uses more tokens but preserves facial detail. */
  detail?: 'high' | 'low' | 'auto';
}

export type ContentPart = TextContentPart | ImageContentPart;

export interface CloudMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

/** Optional parameters for cloud chat requests. */
export interface CloudChatOptions {
  /** Tool definitions (web_search, function calls, MCP, etc.). */
  tools?: ToolDefinition[];
  /** Tool choice strategy: 'auto' lets the model decide. */
  tool_choice?: 'auto' | 'none' | 'required';
  /** Called when the model triggers a web search (before content streams). */
  onWebSearch?: () => void;
  /** Called when a web search completes and the model starts synthesizing. */
  onWebSearchFound?: () => void;
  /** Called when any tool/agent is invoked (name of the tool type). */
  onToolUse?: (toolType: string) => void;
  /** Called when a tool invocation completes. */
  onToolDone?: (toolType: string) => void;
  /** Called when a function_call item is fully streamed (arguments complete). */
  onFunctionCallDone?: (name: string, args: string) => void;
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

/** Sentinel error class for intentional throws inside the SSE parser. */
class StreamEventError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StreamEventError';
  }
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
            onToken(e.delta, stripGrokRenderForDisplay(accumulated));
          } else if (eventType === 'response.output_item.added') {
            const e = raw as unknown as StreamOutputItemAdded;
            if (e.item.type === 'function_call') {
              toolCallAccumulator.set(e.output_index, {
                id: e.item.call_id ?? '',
                name: e.item.name ?? '',
                arguments: '',
              });
            } else if (e.item.type === 'web_search_call') {
              options?.onWebSearch?.();
            } else if (
              e.item.type === 'x_search_call' ||
              e.item.type === 'code_execution_call' ||
              e.item.type === 'mcp_call'
            ) {
              options?.onToolUse?.(e.item.type.replace(/_call$/, ''));
            }
          } else if (eventType === 'response.function_call_arguments.delta') {
            const e = raw as unknown as StreamFunctionCallArgsDelta;
            const existing = toolCallAccumulator.get(e.output_index);
            if (existing) existing.arguments += e.delta;
          } else if (eventType === 'response.output_item.done') {
            const e = raw as unknown as StreamOutputItemDone;
            if (e.item.type === 'web_search_call') {
              options?.onWebSearchFound?.();
            } else if (e.item.type === 'function_call') {
              // Notify caller that a function call is fully streamed.
              // The accumulated arguments for this index are already complete.
              const acc = toolCallAccumulator.get(e.output_index);
              if (acc) {
                options?.onFunctionCallDone?.(acc.name, acc.arguments);
              }
            } else if (
              e.item.type === 'x_search_call' ||
              e.item.type === 'code_execution_call' ||
              e.item.type === 'mcp_call'
            ) {
              options?.onToolDone?.(e.item.type.replace(/_call$/, ''));
            }
          } else if (eventType === 'response.failed') {
            const err = (raw as Record<string, unknown>).response as
              | { error?: { message?: string } }
              | undefined;
            throw new StreamEventError(err?.error?.message ?? 'Response failed');
          } else if (eventType === 'response.incomplete') {
            // The model stopped before finishing — surface a useful message
            const reason = (
              (raw as Record<string, unknown>).response as
                | { incomplete_details?: { reason?: string } }
                | undefined
            )?.incomplete_details?.reason;
            if (!accumulated) {
              throw new StreamEventError(
                reason ? `Incomplete response: ${reason}` : 'Incomplete response',
              );
            }
          }
          // All other events (response.created, response.in_progress,
          // response.completed, etc.) — skip
        } catch (parseErr) {
          // Re-throw intentional stream event errors; skip malformed JSON
          if (parseErr instanceof StreamEventError) throw parseErr;
        }
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

  return { content, toolCalls };
}

/* ─── Image Generation ─── */

interface ImageGenerationResponse {
  data?: { url?: string; b64_json?: string }[];
  error?: { message: string };
}

/**
 * Generate an image via the xAI image generation API through the worker proxy.
 * Returns the temporary URL of the generated image.
 */
export async function generateImage(prompt: string): Promise<string> {
  const response = await fetch(`${WORKER_BASE_URL}/v1/images/generations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, response_format: 'url' }),
  });

  if (!response.ok) {
    let errorMessage = `Image generation failed (${response.status})`;
    try {
      const data = (await response.json()) as ImageGenerationResponse;
      if (data.error?.message) errorMessage = data.error.message;
    } catch {
      // Use default error message
    }
    throw new Error(errorMessage);
  }

  const data = (await response.json()) as ImageGenerationResponse;
  const url = data.data?.[0]?.url;
  if (!url) throw new Error('No image URL returned');
  return url;
}

/* ─── Video Generation ─── */

interface VideoGenerationStartResponse {
  request_id?: string;
  error?: { message: string };
}

interface VideoStatusResponse {
  status: 'pending' | 'done' | 'expired';
  video?: { url: string; duration: number };
  error?: { message: string };
}

/** Maximum polling time for video generation (3 minutes). */
const VIDEO_POLL_TIMEOUT_MS = 180_000;
/** Polling interval for video status checks. */
const VIDEO_POLL_INTERVAL_MS = 5_000;

/**
 * Generate a video via the xAI video generation API through the worker proxy.
 * Handles the async polling flow — submits the request, polls for completion.
 * Returns the temporary URL of the generated video.
 *
 * @param prompt Descriptive text prompt for the video. Be cinematic and specific.
 * @param signal Optional AbortSignal to cancel the generation.
 * @param duration Video duration in seconds (1-15). Defaults to 5.
 */
export async function generateVideo(
  prompt: string,
  signal?: AbortSignal,
  duration = 5,
): Promise<string> {
  // Clamp duration to API limits (1-15 seconds)
  const clampedDuration = Math.max(1, Math.min(15, Math.round(duration)));

  // Step 1: Submit generation request
  const startResponse = await fetch(`${WORKER_BASE_URL}/v1/videos/generations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      duration: clampedDuration,
      aspect_ratio: '16:9',
      resolution: '720p',
    }),
    signal: signal ?? null,
  });

  if (!startResponse.ok) {
    let errorMessage = `Video generation failed (${startResponse.status})`;
    try {
      const data = (await startResponse.json()) as VideoGenerationStartResponse;
      if (data.error?.message) errorMessage = data.error.message;
    } catch {
      // Use default error message
    }
    throw new Error(errorMessage);
  }

  const startData = (await startResponse.json()) as VideoGenerationStartResponse;
  const requestId = startData.request_id;
  if (!requestId) throw new Error('No request_id returned for video generation');

  // Step 2: Poll for completion
  const startTime = Date.now();
  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 5;

  while (Date.now() - startTime < VIDEO_POLL_TIMEOUT_MS) {
    if (signal?.aborted) throw new Error('Video generation aborted');

    await new Promise((resolve) => setTimeout(resolve, VIDEO_POLL_INTERVAL_MS));

    const statusResponse = await fetch(`${WORKER_BASE_URL}/v1/videos/${requestId}`, {
      method: 'GET',
      signal: signal ?? null,
    });

    if (!statusResponse.ok) {
      consecutiveErrors++;
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        throw new Error(
          `Video polling failed ${MAX_CONSECUTIVE_ERRORS} times consecutively (HTTP ${statusResponse.status})`,
        );
      }
      continue;
    }

    consecutiveErrors = 0; // Reset on success
    const statusData = (await statusResponse.json()) as VideoStatusResponse;

    if (statusData.status === 'done' && statusData.video?.url) {
      return statusData.video.url;
    }

    if (statusData.status === 'expired') {
      throw new Error('Video generation request expired');
    }

    // status === 'pending' — continue polling
  }

  throw new Error('Video generation timed out');
}
