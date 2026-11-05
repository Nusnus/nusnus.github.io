/**
 * @file The built writing: an article's page and the Writing page, at every
 * width and in both themes, each load cleanly, pass every axe rule and let the
 * skip link reach their main content. An article's page describes itself as an
 * article and tracks reading progress; the home and Writing pages link each
 * article, newest first, to its page here where it has one; the feed lists each
 * article with a page.
 */

import { WRITING } from "../../src/writing/writing.ts";
import { expect, pageChecks, test } from "../fixtures/smoke-page.ts";

const ARTICLE_PATH = "/articles/elevate-your-game-e2e-thinking/";

pageChecks(ARTICLE_PATH, "an article's page");
pageChecks(WRITING.pagePath, "the Writing page");

test("an article's page describes itself as an article to link previews and search engines", async ({
  page,
}) => {
  await page.goto(ARTICLE_PATH);

  await expect(page).toHaveTitle(
    "Elevate Your Game with E2E Thinking — Tomer Nosrati (Nusnus)",
  );
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute(
    "content",
    "article",
  );
  const structuredData = JSON.parse(
    await page.locator('script[type="application/ld+json"]').innerText(),
  ) as unknown;
  // The page metadata's unit tests check the structured data whole; this
  // checks that the built page carries its article's.
  expect(structuredData).toMatchObject({
    "@type": "Article",
    datePublished: "2023-08-26T00:00:00.000Z",
    headline: "Elevate Your Game with E2E Thinking",
  });
});

test("an article's page shows its date and reading time", async ({ page }) => {
  await page.goto(ARTICLE_PATH);

  await expect(page.locator("header time")).toHaveText("August 26, 2023");
  await expect(page.getByText("2 min read")).toBeVisible();
});

test("an article's reading-progress bar grows as the reader scrolls", async ({
  page,
}) => {
  await page.setViewportSize({ height: 600, width: 1024 });
  await page.goto(ARTICLE_PATH);
  const barWidth = () =>
    page
      .locator("#reading-progress")
      .evaluate((bar) => bar.getBoundingClientRect().width);
  expect(await barWidth()).toBe(0);

  // A late font can lengthen the page after a scroll to its end, so each poll
  // scrolls to the end again.
  await expect
    .poll(async () => {
      await page.evaluate(() => {
        window.scrollTo(0, document.documentElement.scrollHeight);
      });
      return barWidth();
    })
    .toBe(1024);
});

for (const { name, path } of [
  { name: "the home page", path: "/" },
  { name: "the Writing page", path: WRITING.pagePath },
]) {
  test(`${name} links each article, newest first, to its page here where it has one, else to LinkedIn`, async ({
    page,
  }) => {
    await page.goto(path);

    const links = await page
      .locator('a[aria-label^="Read "]')
      .evaluateAll((elements) =>
        elements.map((link) => [
          link.getAttribute("aria-label"),
          link.getAttribute("href"),
        ]),
      );

    expect(links).toStrictEqual([
      [
        "Read Celery: Now Powered By Blacksmith",
        "https://www.linkedin.com/pulse/celery-now-powered-blacksmith-tomer-nosrati-ew68e",
      ],
      [
        "Read The Subtle Art of Making Every Word Count",
        "/articles/subtle-art-making-every-word-count/",
      ],
      [
        "Read Elevate Your Game with E2E Thinking",
        "/articles/elevate-your-game-e2e-thinking/",
      ],
    ]);
  });
}

test("the feed lists each article with a page here, newest first", async ({
  request,
}) => {
  const feed = await (await request.get(WRITING.feedPath)).text();

  expect(
    [...feed.matchAll(/<link>([^<]+)<\/link>/g)].map(([, link]) => link),
  ).toStrictEqual([
    "https://nusnus.github.io/",
    "https://nusnus.github.io/articles/subtle-art-making-every-word-count/",
    "https://nusnus.github.io/articles/elevate-your-game-e2e-thinking/",
  ]);
});
