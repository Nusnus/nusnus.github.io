/**
 * Cloudflare Worker — AI API Proxy (Production)
 *
 * Proxies requests to xAI (Grok) via the Responses API.
 * The API key is stored as a Cloudflare secret — never in source code.
 *
 * Routes:
 *   POST /v1/responses — proxy to xAI Responses API (SSE streaming + JSON)
 *   POST /voice/token  — mint ephemeral token for xAI Voice Agent WS
 *   GET  /github/*     — GitHub data proxy (profile, repos, activity…)
 *   GET  /             — health check
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
  'http://localhost:3000',
]);

const XAI_RESPONSES_URL = 'https://api.x.ai/v1/responses';
const XAI_VOICE_TOKEN_URL = 'https://api.x.ai/v1/realtime/client_secrets';

/** Models visitors are allowed to use. Prevents switching to costly models. */
const ALLOWED_MODELS: ReadonlySet<string> = new Set([
  'grok-4-1-fast',
  'grok-4-1-fast-reasoning',
  'grok-4-1-fast-non-reasoning',
  'grok-code-fast',
  'grok-code-fast-1',
]);

const DEFAULT_MODEL = 'grok-4-1-fast-reasoning';

/** Hard limits to prevent abuse. */
const MAX_REQUEST_BYTES = 262_144; // 256 KB — full context + MCP tool defs + chat history
const MAX_OUTPUT_TOKENS_CAP = 2048;
const MAX_INPUT_ITEMS = 40;
const MAX_TOOLS = 20;
const VOICE_TOKEN_TTL_SECONDS = 300;

/** MCP server URLs the client is allowed to request. */
const ALLOWED_MCP_SERVERS: ReadonlySet<string> = new Set([
  'https://mcp.deepwiki.com/mcp',
  'https://mcp.context7.com/mcp',
]);

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

    // ── Route dispatch ──
    const postPath = new URL(request.url).pathname;

    // ── Voice ephemeral token ──
    // Browser connects to wss://api.x.ai/v1/realtime directly using this token
    // in the sec-websocket-protocol header. No WS proxy needed.
    if (postPath === '/voice/token') {
      if (!isAllowed) return jsonResponse({ error: 'Forbidden' }, 403);
      const clientIP = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      if (isRateLimited(clientIP)) {
        return jsonResponse({ error: 'Rate limit exceeded' }, 429, origin);
      }
      if (!env.XAI_API_KEY) return jsonResponse({ error: 'Server misconfigured' }, 500, origin);

      try {
        const tokenRes = await fetch(XAI_VOICE_TOKEN_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.XAI_API_KEY}`,
          },
          body: JSON.stringify({ expires_after: { seconds: VOICE_TOKEN_TTL_SECONDS } }),
        });
        if (!tokenRes.ok) {
          const errText = await tokenRes.text().catch(() => '');
          console.error(`[ai-proxy] voice token ${tokenRes.status}: ${errText}`);
          return jsonResponse({ error: 'Failed to mint voice token' }, 502, origin);
        }
        const data = (await tokenRes.json()) as {
          client_secret?: { value?: string } | string;
          value?: string;
        };
        // xAI may return {value} or {client_secret: {value}} — handle both
        const token =
          typeof data.client_secret === 'string'
            ? data.client_secret
            : (data.client_secret?.value ?? data.value);
        if (!token) {
          return jsonResponse({ error: 'Token response missing value' }, 502, origin);
        }
        return jsonResponse({ token }, 200, origin);
      } catch (err) {
        console.error(`[ai-proxy] voice token error: ${err instanceof Error ? err.message : err}`);
        return jsonResponse({ error: 'Failed to reach AI provider' }, 502, origin);
      }
    }

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

    // ── Tool validation — cap count + MCP server allowlist ──
    if (body.tools !== undefined) {
      if (!Array.isArray(body.tools)) {
        return jsonResponse({ error: 'tools must be an array' }, 400, origin);
      }
      if (body.tools.length > MAX_TOOLS) {
        return jsonResponse({ error: `Too many tools (max ${MAX_TOOLS})` }, 400, origin);
      }
      for (const tool of body.tools) {
        const t = tool as { type?: string; server_url?: string };
        if (t.type === 'mcp' && t.server_url && !ALLOWED_MCP_SERVERS.has(t.server_url)) {
          return jsonResponse({ error: 'MCP server not allowed' }, 400, origin);
        }
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
