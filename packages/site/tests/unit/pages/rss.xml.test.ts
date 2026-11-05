/**
 * @file `/rss.xml` is the writing feed: an item for each article with a page
 * here, newest first, linking to that page.
 */

import type { APIContext } from "astro";

import { describe, expect, it } from "vitest";

import { GET } from "../../../src/pages/rss.xml.ts";

describe("GET /rss.xml", () => {
  it("lists each article with a page, newest first, linking to its page on the site's URL", async () => {
    const response = await GET({} as APIContext);

    expect(await response.text()).toBe(
      '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Tomer Nosrati (Nusnus) — Writing</title><description>Thoughts on distributed systems, open source leadership, and software engineering philosophy.</description><link>https://nusnus.github.io/</link><item><title>The Subtle Art of Making Every Word Count</title><link>https://nusnus.github.io/articles/subtle-art-making-every-word-count/</link><guid isPermaLink="true">https://nusnus.github.io/articles/subtle-art-making-every-word-count/</guid><description>The Point-First Approach (PFA) — your escape hatch from verbosity and your gateway to focused, meaningful conversations.</description><pubDate>Sat, 09 Sep 2023 00:00:00 GMT</pubDate><category>communication</category><category>philosophy</category><category>productivity</category></item><item><title>Elevate Your Game with E2E Thinking</title><link>https://nusnus.github.io/articles/elevate-your-game-e2e-thinking/</link><guid isPermaLink="true">https://nusnus.github.io/articles/elevate-your-game-e2e-thinking/</guid><description>Taking an end-to-end approach is more than just a professional technique; it&apos;s a lifestyle philosophy.</description><pubDate>Sat, 26 Aug 2023 00:00:00 GMT</pubDate><category>leadership</category><category>philosophy</category><category>software engineering</category></item></channel></rss>',
    );
  });
});
