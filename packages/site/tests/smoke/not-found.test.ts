/**
 * @file The built not-found page, at every width and in both themes: it is
 * served with status 404 for any URL the site lacks, passes every axe rule,
 * lets the skip link reach its main content, and claims no canonical URL.
 */

import { expect, pageChecks, test } from "../fixtures/smoke-page.ts";

const MISSING_PATH = "/no-such-page/";

// The browser reports the 404 status of the page itself.
test.use({
  expectedProblems: [
    "console.error: Failed to load resource: the server responded with a status of 404 (Not Found)",
  ],
});

pageChecks(MISSING_PATH, "the not-found page");

test.describe("the not-found page", () => {
  test("is served with status 404 and names no canonical URL", async ({
    page,
  }) => {
    const response = await page.goto(MISSING_PATH);

    expect(response?.status()).toBe(404);
    await expect(page).toHaveTitle("Page not found — Tomer Nosrati (Nusnus)");
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  });
});
