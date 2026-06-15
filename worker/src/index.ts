/**
 * Cloudflare Worker — GitHub data proxy for nusnus.github.io.
 *
 * Serves live, edge-cached GitHub profile / repo / activity / contribution data
 * with a stale-while-revalidate policy (see ./github). The PAT is stored as a
 * Cloudflare secret — never in source.
 *
 * Security layers:
 *  1. Origin allowlist (CORS)
 *  2. GET-only (plus OPTIONS preflight)
 */

import { handleGitHubRoute } from './github';

interface Env {
  GITHUB_TOKEN: string;
}

const ALLOWED_ORIGINS: ReadonlySet<string> = new Set([
  'https://nusnus.github.io',
  'http://localhost:4321',
  'http://localhost:4322',
  'http://localhost:3000',
]);

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const origin = request.headers.get('Origin') ?? '';
    const isAllowed = ALLOWED_ORIGINS.has(origin);
    const { pathname } = new URL(request.url);

    // ── CORS preflight ──
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: isAllowed ? corsHeaders(origin) : {},
      });
    }

    // ── Health check ──
    if (request.method === 'GET' && pathname === '/') {
      return jsonResponse({ status: 'ok' }, 200);
    }

    // ── Only GET is supported beyond this point ──
    if (request.method !== 'GET') {
      return jsonResponse({ error: 'Method not allowed' }, 405, origin);
    }

    // ── Origin guard ──
    if (!isAllowed) {
      return jsonResponse({ error: 'Forbidden' }, 403);
    }

    // ── GitHub data routes (GET /github/*) ──
    if (!env.GITHUB_TOKEN) {
      return jsonResponse({ error: 'GitHub token not configured' }, 500, origin);
    }

    const ghResponse = await handleGitHubRoute(request, env.GITHUB_TOKEN, corsHeaders(origin), ctx);
    if (ghResponse) return ghResponse;

    return jsonResponse({ error: 'Not found' }, 404, origin);
  },
};
