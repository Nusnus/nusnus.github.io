/**
 * @file The built home page, at every width and in both themes: it loads
 * cleanly, meets every accessibility rule axe checks, has one visible `h1`,
 * lets the skip link reach the main content, scrolls each column on its own,
 * and lists its sections in the order the navigation links to them.
 */

import { expect, pageChecks, test, VIEWPORTS } from "../fixtures/smoke-page.ts";

pageChecks("/", "the home page");

for (const viewport of VIEWPORTS) {
  test(`at ${String(viewport.width)}px, the home page shows one h1, naming Tomer`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");

    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("h1")).toHaveText("Tomer Nosrati");
  });
}

test("on a desktop shorter than the sidebar, only the columns scroll, not the page", async ({
  page,
}) => {
  await page.setViewportSize({ height: 400, width: 1536 });
  await page.goto("/");
  // The sidebar's last control, and the main column's last section.
  const columnEnds = [
    page.getByRole("button", { name: /^Switch to (?:light|dark) mode$/ }),
    page.getByRole("region", { name: "Sponsor Celery" }),
  ];

  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight,
    ),
  ).toBe(0);
  for (const columnEnd of columnEnds) {
    await expect(columnEnd).not.toBeInViewport();
    await columnEnd.scrollIntoViewIfNeeded();
    await expect(columnEnd).toBeInViewport();
  }
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test("the navigation links to the home page's sections in page order", async ({
  page,
}) => {
  await page.goto("/");

  const navigationTargets = await page
    .getByRole("navigation", { name: "Page sections" })
    .getByRole("link")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  const sectionAnchors = await page
    .locator("main section[id]")
    .evaluateAll((sections) => sections.map((section) => `#${section.id}`));

  expect([navigationTargets, sectionAnchors]).toStrictEqual([
    [
      "#activity",
      "#collaborations",
      "#activity-graph",
      "#projects",
      "#celery-organization",
      "#writing",
      "#sponsoring",
    ],
    [
      "#activity",
      "#collaborations",
      "#activity-graph",
      "#projects",
      "#celery-organization",
      "#writing",
      "#sponsoring",
    ],
  ]);
});
