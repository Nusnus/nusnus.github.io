/**
 * @file `/robots.txt`: lets every crawler index the whole site, and points them
 * to its sitemap.
 */

import type { APIRoute } from "astro";

import { SITE_URL, SITEMAP_PATH } from "../site.ts";

export const GET: APIRoute = () =>
  new Response(
    `User-agent: *\nAllow: /\n\nSitemap: ${new URL(SITEMAP_PATH, SITE_URL).href}\n`,
  );
