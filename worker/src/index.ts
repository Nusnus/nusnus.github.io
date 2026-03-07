/**
 * Cloudflare Worker — AI API Proxy (Production)
 *
 * Proxies requests to xAI (Grok) via the Responses API.
 * The API key is stored as a Cloudflare secret — never in source code.
 *
 * Security layers:
 *  1. Origin allowlist (CORS)
 *  2. Method restriction (POST only, OPTIONS for preflight)
 *  3. Content-Type validation
 *  4. Request body size limit
 *  5. Payload schema validation (input array required)
 *  6. Model allowlist (prevent abuse of expensive models)
 *  7. max_output_tokens cap (prevent runaway costs)
 *  8. Per-IP rate limiting via Cloudflare KV-free approach (in-memory)
 */

import { handleGitHubRoute } from './github';

// ─── Types ───────────────────────────────────────────────────────────

interface Env {
  XAI_API_KEY: string;
  GITHUB_TOKEN: string;
}

interface InputMessage {
  role: 'system' | 'user' | 'assistant';
  content?: string | null;
}

interface ResponsesAPIRequest {
  model?: string;
  input?: InputMessage[];
  max_output_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  /** Tools — includes built-in tools (web_search) and function definitions. */
  tools?: unknown[];
  /** Tool choice strategy — passed through to xAI. */
  tool_choice?: unknown;
  [key: string]: unknown;
}

// ─── Configuration ───────────────────────────────────────────────────

const ALLOWED_ORIGINS: ReadonlySet<string> = new Set([
  'https://nusnus.github.io',
  'http://localhost:4321',
  'http://localhost:4322',
  'http://localhost:3000',
]);

const XAI_RESPONSES_URL = 'https://api.x.ai/v1/responses';
const XAI_REALTIME_SECRETS_URL = 'https://api.x.ai/v1/realtime/client_secrets';

/** Models visitors are allowed to use. Prevents switching to costly models. */
const ALLOWED_MODELS: ReadonlySet<string> = new Set([
  'grok-4-1-fast',
  'grok-4-1-fast-reasoning',
  'grok-4-1-fast-non-reasoning',
  'grok-code-fast',
  'grok-code-fast-1',
]);

const DEFAULT_MODEL = 'grok-4-1-fast';

/** Hard limits to prevent abuse. */
const MAX_REQUEST_BYTES = 131_072; // 128 KB — accommodates full context + tools + chat history
const MAX_OUTPUT_TOKENS_CAP = 1024;
const MAX_INPUT_ITEMS = 30;

/** Simple in-memory rate limiter (per-isolate, resets on cold start). */
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20; // per IP per window
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// ─── Helpers ─────────────────────────────────────────────────────────

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(body: Record<string, unknown>, status: number, origin?: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...(origin ? corsHeaders(origin) : {}),
    },
  });
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  // Periodically clean stale entries to prevent memory leaks
  if (rateLimitMap.size > 1000) {
    for (const [key, val] of rateLimitMap) {
      if (now > val.resetAt) rateLimitMap.delete(key);
    }
  }

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT_MAX_REQUESTS;
}

// ─── Worker ──────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') ?? '';
    const isAllowed = ALLOWED_ORIGINS.has(origin);

    // ── CORS preflight ──
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: isAllowed ? corsHeaders(origin) : {},
      });
    }

    // ── Health check ──
    if (request.method === 'GET' && new URL(request.url).pathname === '/') {
      return jsonResponse({ status: 'ok' }, 200);
    }

    // ── GitHub data routes (GET /github/*) ──
    if (request.method === 'GET' && !env.GITHUB_TOKEN) {
      return jsonResponse({ error: 'GitHub token not configured' }, 500, origin);
    }
    if (request.method === 'GET') {
      if (!isAllowed) return jsonResponse({ error: 'Forbidden' }, 403);
      const ghResponse = await handleGitHubRoute(request, env.GITHUB_TOKEN, corsHeaders(origin));
      if (ghResponse) return ghResponse;
      return jsonResponse({ error: 'Not found' }, 404, origin);
    }

    // ── Method guard ──
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405, origin);
    }

    // ── Route POST requests ──
    const postPath = new URL(request.url).pathname;

    // ── Realtime ephemeral token endpoint ──
    if (postPath === '/v1/realtime/client_secrets') {
      if (!isAllowed) return jsonResponse({ error: 'Forbidden' }, 403);
      if (!env.XAI_API_KEY) return jsonResponse({ error: 'Server misconfigured' }, 500, origin);

      const clientIP = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      if (isRateLimited(clientIP)) {
        return jsonResponse({ error: 'Rate limit exceeded. Try again shortly.' }, 429, origin);
      }

      try {
        const xaiRes = await fetch(XAI_REALTIME_SECRETS_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.XAI_API_KEY}`,
          },
          body: JSON.stringify({ expires_after: { seconds: 300 } }),
        });

        const body = await xaiRes.text();
        return new Response(body, {
          status: xaiRes.status,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to get ephemeral token';
        console.error(`[ai-proxy] Realtime token error: ${message}`);
        return jsonResponse({ error: 'Failed to get ephemeral token' }, 502, origin);
      }
    }

    // ── Path guard — only /v1/responses beyond this point ──
    if (postPath !== '/v1/responses') {
      return jsonResponse({ error: 'Not found' }, 404, origin);
    }

    // ── Origin guard ──
    if (!isAllowed) {
      return jsonResponse({ error: 'Forbidden' }, 403);
    }

    // ── Rate limiting ──
    const clientIP = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    if (isRateLimited(clientIP)) {
      return jsonResponse({ error: 'Rate limit exceeded. Try again shortly.' }, 429, origin);
    }

    // ── Content-Type guard ──
    const contentType = request.headers.get('Content-Type') ?? '';
    if (!contentType.includes('application/json')) {
      return jsonResponse({ error: 'Content-Type must be application/json' }, 415, origin);
    }

    // ── API key guard ──
    if (!env.XAI_API_KEY) {
      return jsonResponse({ error: 'Server misconfigured' }, 500, origin);
    }

    // ── Body size guard ──
    const contentLength = parseInt(request.headers.get('Content-Length') ?? '0', 10);
    if (contentLength > MAX_REQUEST_BYTES) {
      return jsonResponse({ error: 'Request too large' }, 413, origin);
    }

    let body: ResponsesAPIRequest;
    try {
      const raw = await request.text();
      if (raw.length > MAX_REQUEST_BYTES) {
        return jsonResponse({ error: 'Request too large' }, 413, origin);
      }
      body = JSON.parse(raw) as ResponsesAPIRequest;
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, 400, origin);
    }

    // ── Payload validation (Responses API uses `input` instead of `messages`) ──
    if (!Array.isArray(body.input) || body.input.length === 0) {
      return jsonResponse({ error: 'input array is required' }, 400, origin);
    }

    if (body.input.length > MAX_INPUT_ITEMS) {
      return jsonResponse({ error: `Too many input items (max ${MAX_INPUT_ITEMS})` }, 400, origin);
    }

    // Validate each input message has required fields
    for (const msg of body.input) {
      if (!msg.role) {
        return jsonResponse({ error: 'Each input item must have a role' }, 400, origin);
      }
      if (typeof msg.content !== 'string') {
        return jsonResponse({ error: 'Each input item must have string content' }, 400, origin);
      }
    }

    // ── Enforce model allowlist + token cap ──
    const requestedModel = body.model ?? DEFAULT_MODEL;
    if (!ALLOWED_MODELS.has(requestedModel)) {
      body.model = DEFAULT_MODEL;
    } else {
      body.model = requestedModel;
    }

    body.max_output_tokens = Math.min(
      body.max_output_tokens ?? MAX_OUTPUT_TOKENS_CAP,
      MAX_OUTPUT_TOKENS_CAP,
    );

    // Allow client to opt into streaming
    const wantsStream = body.stream === true;
    body.stream = wantsStream;

    // ── Forward to xAI Responses API ──
    try {
      const xaiResponse = await fetch(XAI_RESPONSES_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.XAI_API_KEY}`,
        },
        body: JSON.stringify(body),
      });

      if (wantsStream) {
        // Pipe the SSE stream straight through to the client
        if (!xaiResponse.ok || !xaiResponse.body) {
          const errorBody = await xaiResponse.text().catch(() => 'Upstream error');
          return new Response(errorBody, {
            status: xaiResponse.status || 502,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
          });
        }
        return new Response(xaiResponse.body, {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            ...corsHeaders(origin),
          },
        });
      }

      // Non-streaming: return full JSON response
      const responseBody = await xaiResponse.text();

      // Forward xAI status code (200, 400, 429, 500, etc.)
      return new Response(responseBody, {
        status: xaiResponse.status,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(origin),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upstream request failed';
      console.error(`[ai-proxy] xAI error: ${message}`);
      return jsonResponse({ error: 'Failed to reach AI provider' }, 502, origin);
    }
  },
};
