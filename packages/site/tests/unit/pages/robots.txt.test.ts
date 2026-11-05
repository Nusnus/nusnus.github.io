/**
 * @file `/robots.txt` opens the whole site to crawlers and names its sitemap.
 */

import type { APIContext } from "astro";

import { describe, expect, it } from "vitest";

import { GET } from "../../../src/pages/robots.txt.ts";

describe("GET /robots.txt", () => {
  it("allows every crawler everywhere and points to the sitemap on the site's URL", async () => {
    const response = await GET({} as APIContext);

    expect(await response.text()).toBe(
      "User-agent: *\nAllow: /\n\nSitemap: https://nusnus.github.io/sitemap-index.xml\n",
    );
  });
});
