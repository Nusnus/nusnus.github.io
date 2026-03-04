/**
 * Cloud AI client — sends chat completions to the Cloudflare Worker proxy.
 *
 * The proxy forwards requests to xAI (Grok) with the API key injected
 * server-side. This module is only used when the "Cloud" provider is selected.
 *
 * Supports both non-streaming (cloudChat) and streaming (cloudChatStream).
 */

import { CLOUD_PROXY_URL, CLOUD_GENERATION_CONFIG } from './config';

export interface CloudMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface CloudChoice {
  message: { content: string };
  finish_reason: string;
}

interface CloudResponse {
  choices?: CloudChoice[];
  error?: { message: string };
}

/**
 * Send a chat completion request to the cloud proxy (non-streaming).
 * Returns the assistant's full response text.
 *
 * @throws Error if the proxy or upstream returns an error.
 */
export async function cloudChat(messages: CloudMessage[], modelId: string): Promise<string> {
  const response = await fetch(CLOUD_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelId,
      messages,
      stream: false,
      ...CLOUD_GENERATION_CONFIG,
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

  if (!data.choices?.[0]?.message?.content) {
    throw new Error('Empty response from AI provider');
  }

  return data.choices[0].message.content;
}

/**
 * SSE streaming delta shape from OpenAI-compatible APIs.
 */
interface StreamDelta {
  choices?: { delta?: { content?: string }; finish_reason?: string | null }[];
}

/**
 * Send a streaming chat completion request to the cloud proxy.
 * Calls `onToken` for each delta chunk as it arrives.
 * Returns the full accumulated response text.
 *
 * @throws Error if the proxy or upstream returns an error.
 */
export async function cloudChatStream(
  messages: CloudMessage[],
  modelId: string,
  onToken: (token: string, accumulated: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch(CLOUD_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelId,
      messages,
      stream: true,
      ...CLOUD_GENERATION_CONFIG,
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
          const content = json.choices?.[0]?.delta?.content;
          if (content) {
            accumulated += content;
            onToken(content, accumulated);
          }
        } catch {
          // Skip malformed JSON chunks
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!accumulated) {
    throw new Error('Empty response from AI provider');
  }

  return accumulated;
}
