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
  content?: string | unknown[] | null;
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
const XAI_TTS_URL = 'https://api.x.ai/v1/tts';
const XAI_IMAGES_URL = 'https://api.x.ai/v1/images/generations';
const XAI_VIDEOS_URL = 'https://api.x.ai/v1/videos/generations';
const XAI_VIDEOS_STATUS_URL = 'https://api.x.ai/v1/videos';

/** Models visitors are allowed to use. Prevents switching to costly models. */
const ALLOWED_MODELS: ReadonlySet<string> = new Set([
  'grok-4.20-beta-latest-non-reasoning',
  'grok-4.20-beta-latest',
  'grok-4-1-fast',
  'grok-4-1-fast-reasoning',
  'grok-4-1-fast-non-reasoning',
  'grok-code-fast',
  'grok-code-fast-1',
]);

const DEFAULT_MODEL = 'grok-4.20-beta-latest';

/** Hard limits to prevent abuse. */
const MAX_REQUEST_BYTES = 6_291_456; // 6 MB — /v1/responses only (full context + multiple base64 reference photos)
const MAX_SMALL_REQUEST_BYTES = 131_072; // 128 KB — TTS, image, and video endpoints
const MAX_OUTPUT_TOKENS_CAP = 4096;
const MAX_INPUT_ITEMS = 80; // 1 system + up to 30 user + 30 assistant + margin

/** Simple in-memory rate limiter (per-isolate, resets on cold start). */
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20; // per IP per window
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

/** Billing-alert cooldown — max 1 alert per hour (per isolate). */
const BILLING_ALERT_COOLDOWN_MS = 3_600_000; // 1 hour
let lastBillingAlertSentAt = 0;
const GITHUB_ISSUES_URL = 'https://api.github.com/repos/Nusnus/nusnus.github.io/issues';

// ─── Helpers ─────────────────────────────────────────────────────────

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

// ─── Billing Alert ───────────────────────────────────────────────────

/** Returns true if the xAI response body indicates a billing/credits error. */
function isBillingError(responseBody: string): boolean {
  const lower = responseBody.toLowerCase();
  return (
    lower.includes('used all available credits') ||
    lower.includes('spending limit') ||
    lower.includes('insufficient_quota') ||
    lower.includes('billing_hard_limit_reached') ||
    lower.includes('billing error')
  );
}

/**
 * Create a GitHub issue as a billing alert (fire-and-forget, never throws).
 * Rate-limited to 1 alert per hour to avoid spam.
 * Uses the existing GITHUB_TOKEN — no external service needed.
 */
async function sendBillingAlert(env: Env, endpoint: string, responseBody: string): Promise<void> {
  const now = Date.now();
  if (now - lastBillingAlertSentAt < BILLING_ALERT_COOLDOWN_MS) return;
  lastBillingAlertSentAt = now;

  if (!env.GITHUB_TOKEN) {
    console.warn(
      '[ai-proxy] Billing error detected but GITHUB_TOKEN is not configured — skipping alert.',
    );
    return;
  }

  try {
    const timestamp = new Date().toISOString();
    const truncatedBody = responseBody.slice(0, 2000);
    const res = await fetch(GITHUB_ISSUES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'ai-proxy-worker',
      },
      body: JSON.stringify({
        title: `⚠️ xAI API Billing Alert — Credits Exhausted (${endpoint})`,
        body: [
          '## xAI API Billing Alert',
          '',
          `**Time:** ${timestamp}`,
          `**Endpoint:** \`${endpoint}\``,
          '',
          '**Error response:**',
          '```json',
          truncatedBody,
          '```',
          '',
          'Please add funds or raise the spending limit in the [xAI dashboard](https://console.x.ai).',
          '',
          '---',
          '*This issue was auto-created by the ai-proxy Cloudflare Worker.*',
        ].join('\n'),
        labels: ['billing-alert'],
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => 'unknown');
      console.error(`[ai-proxy] Failed to create billing alert issue: ${res.status} ${errText}`);
    } else {
      console.log('[ai-proxy] Billing alert issue created on GitHub.');
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    console.error(`[ai-proxy] Failed to create billing alert issue: ${msg}`);
  }
}

/**
 * Check an xAI upstream response for billing errors and fire an alert if needed.
 * Returns the response body string so callers can reuse it.
 */
async function checkAndAlertBilling(
  env: Env,
  xaiResponse: Response,
  endpoint: string,
): Promise<string> {
  const responseBody = await xaiResponse.text();
  if (!xaiResponse.ok && isBillingError(responseBody)) {
    // Fire-and-forget — don't block the response
    void sendBillingAlert(env, endpoint, responseBody);
  }
  return responseBody;
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

    // ── GET routes ──
    if (request.method === 'GET') {
      if (!isAllowed) return jsonResponse({ error: 'Forbidden' }, 403);

      const getPath = new URL(request.url).pathname;

      // ── Video status polling (GET /v1/videos/:requestId) ──
      // Exempt from rate limiting — lightweight status check polled every 5s
      const videoMatch = getPath.match(/^\/v1\/videos\/([a-f0-9-]+)$/);
      if (videoMatch) {
        const requestId = videoMatch[1];
        if (!env.XAI_API_KEY) return jsonResponse({ error: 'Server misconfigured' }, 500, origin);

        try {
          const xaiRes = await fetch(`${XAI_VIDEOS_STATUS_URL}/${requestId}`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${env.XAI_API_KEY}` },
          });
          const responseBody = await checkAndAlertBilling(env, xaiRes, '/v1/videos/:id');
          return new Response(responseBody, {
            status: xaiRes.status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Video status check failed';
          console.error(`[ai-proxy] Video status error: ${message}`);
          return jsonResponse({ error: 'Failed to check video status' }, 502, origin);
        }
      }

      // ── GitHub data routes (GET /github/*) ──
      if (!env.GITHUB_TOKEN) {
        return jsonResponse({ error: 'GitHub token not configured' }, 500, origin);
      }

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

        const body = await checkAndAlertBilling(env, xaiRes, '/v1/realtime/client_secrets');
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

    // ── TTS endpoint (text-to-speech proxy) ──
    if (postPath === '/v1/tts') {
      if (!isAllowed) return jsonResponse({ error: 'Forbidden' }, 403);
      if (!env.XAI_API_KEY) return jsonResponse({ error: 'Server misconfigured' }, 500, origin);

      const ttsClientIP = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      if (isRateLimited(ttsClientIP)) {
        return jsonResponse({ error: 'Rate limit exceeded. Try again shortly.' }, 429, origin);
      }

      try {
        const ttsBody = await request.text();
        if (ttsBody.length > MAX_SMALL_REQUEST_BYTES) {
          return jsonResponse({ error: 'Request too large' }, 413, origin);
        }
        const xaiRes = await fetch(XAI_TTS_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.XAI_API_KEY}`,
          },
          body: ttsBody,
        });

        if (!xaiRes.ok || !xaiRes.body) {
          const errorBody = await xaiRes.text().catch(() => 'TTS error');
          if (isBillingError(errorBody)) {
            void sendBillingAlert(env, '/v1/tts', errorBody);
          }
          return new Response(errorBody, {
            status: xaiRes.status || 502,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
          });
        }

        return new Response(xaiRes.body, {
          status: 200,
          headers: {
            'Content-Type': xaiRes.headers.get('Content-Type') ?? 'audio/mpeg',
            'Cache-Control': 'no-cache',
            ...corsHeaders(origin),
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'TTS request failed';
        console.error(`[ai-proxy] TTS error: ${message}`);
        return jsonResponse({ error: 'Failed to generate speech' }, 502, origin);
      }
    }

    // ── Image generation endpoint ──
    if (postPath === '/v1/images/generations') {
      if (!isAllowed) return jsonResponse({ error: 'Forbidden' }, 403);
      if (!env.XAI_API_KEY) return jsonResponse({ error: 'Server misconfigured' }, 500, origin);

      const imgClientIP = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      if (isRateLimited(imgClientIP)) {
        return jsonResponse({ error: 'Rate limit exceeded. Try again shortly.' }, 429, origin);
      }

      try {
        const imgBody = await request.text();
        if (imgBody.length > MAX_SMALL_REQUEST_BYTES) {
          return jsonResponse({ error: 'Request too large' }, 413, origin);
        }

        // Validate and enforce model
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(imgBody) as Record<string, unknown>;
        } catch {
          return jsonResponse({ error: 'Invalid JSON' }, 400, origin);
        }

        // Force model to grok-imagine-image
        parsed.model = 'grok-imagine-image';

        const xaiRes = await fetch(XAI_IMAGES_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.XAI_API_KEY}`,
          },
          body: JSON.stringify(parsed),
        });

        const responseBody = await checkAndAlertBilling(env, xaiRes, '/v1/images/generations');
        return new Response(responseBody, {
          status: xaiRes.status,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Image generation failed';
        console.error(`[ai-proxy] Image generation error: ${message}`);
        return jsonResponse({ error: 'Failed to generate image' }, 502, origin);
      }
    }

    // ── Video generation endpoint ──
    if (postPath === '/v1/videos/generations') {
      if (!isAllowed) return jsonResponse({ error: 'Forbidden' }, 403);
      if (!env.XAI_API_KEY) return jsonResponse({ error: 'Server misconfigured' }, 500, origin);

      const vidClientIP = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      if (isRateLimited(vidClientIP)) {
        return jsonResponse({ error: 'Rate limit exceeded. Try again shortly.' }, 429, origin);
      }

      try {
        const vidBody = await request.text();
        if (vidBody.length > MAX_SMALL_REQUEST_BYTES) {
          return jsonResponse({ error: 'Request too large' }, 413, origin);
        }

        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(vidBody) as Record<string, unknown>;
        } catch {
          return jsonResponse({ error: 'Invalid JSON' }, 400, origin);
        }

        // Force model to grok-imagine-video
        parsed.model = 'grok-imagine-video';

        const xaiRes = await fetch(XAI_VIDEOS_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.XAI_API_KEY}`,
          },
          body: JSON.stringify(parsed),
        });

        const responseBody = await checkAndAlertBilling(env, xaiRes, '/v1/videos/generations');
        return new Response(responseBody, {
          status: xaiRes.status,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Video generation failed';
        console.error(`[ai-proxy] Video generation error: ${message}`);
        return jsonResponse({ error: 'Failed to generate video' }, 502, origin);
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
      // Content can be a string or an array of content parts (multimodal)
      if (typeof msg.content !== 'string' && !Array.isArray(msg.content)) {
        return jsonResponse(
          { error: 'Each input item must have string or array content' },
          400,
          origin,
        );
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
          if (isBillingError(errorBody)) {
            void sendBillingAlert(env, '/v1/responses (stream)', errorBody);
          }
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
      const responseBody = await checkAndAlertBilling(env, xaiResponse, '/v1/responses');

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
