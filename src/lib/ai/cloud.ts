/**
 * Cloud AI client — sends chat completions to the Cloudflare Worker proxy.
 *
 * The proxy forwards requests to xAI (Grok) with the API key injected
 * server-side. This module is only used when the "Cloud" provider is selected.
 */

import { CLOUD_PROXY_URL, CLOUD_GENERATION_CONFIG } from './config';

interface CloudMessage {
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
 * Send a chat completion request to the cloud proxy.
 * Returns the assistant's response text.
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
