/**
 * @file The built mobile drawer: closed, it is out of reach of the keyboard and
 * assistive technology; open, it holds focus, passes every axe rule, and closes
 * on Escape, on its close button, on a jump to a section, returning focus to
 * the menu button, and as the viewport reaches the width where the sidebar
 * shows, which is Tailwind's `md`.
 */

import type { Page } from "@playwright/test";

import { THEMES } from "../../src/theme/theme.ts";
import {
  expect,
  expectAccessible,
  test,
  VIEWPORTS,
} from "../fixtures/smoke-page.ts";

const [PHONE, TABLET] = VIEWPORTS;

// Closing drops the dialog's `open` at once; the drawer then slides out over
// 300ms, which a loaded machine can stretch past expect's timeout, so a test
// of closing waits for the first, not the end of the slide.
async function expectClosed(page: Page): Promise<void> {
  await expect(page.locator("dialog")).not.toHaveAttribute("open");
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto("/");
});

test("while closed, the drawer is out of the tab order and the accessibility tree", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Open navigation menu" }).focus();

  await page.keyboard.press("Tab");

  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      document.querySelector("dialog")?.contains(document.activeElement),
    ),
  ).toBe(false);
});

for (const theme of THEMES) {
  test(`open in the ${theme} theme, the drawer has no accessibility violations`, async ({
    page,
  }) => {
    await page.emulateMedia({
      colorScheme: theme,
      // A value fading in mid-animation is not low in contrast once it
      // settles; axe judges the settled page.
      reducedMotion: "reduce",
    });
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    await expect(page.getByRole("dialog")).toBeInViewport({ ratio: 1 });

    await expectAccessible(page);
  });
}

test("open, the drawer keeps focus inside it", async ({ page }) => {
  await page.getByRole("button", { name: "Open navigation menu" }).click();
  const drawer = page.getByRole("dialog", { name: "Mobile navigation" });
  await expect(
    drawer.getByRole("button", { name: "Close navigation menu" }),
  ).toBeFocused();

  // Tab well past the drawer's last link, which would leave a drawer that
  // fails to hold focus. Past the last, Chromium hands focus to its own
  // toolbar, which leaves the page's active element <body>, and then back to
  // the drawer, as it does past the last control of any page.
  for (let step = 0; step < 30; step += 1) {
    await page.keyboard.press("Tab");
    const insideDrawer = await page.evaluate(
      () =>
        document.activeElement === document.body ||
        document.querySelector("dialog")?.contains(document.activeElement),
    );
    expect(insideDrawer).toBe(true);
  }
});

test("Escape closes the drawer and returns focus to the menu button", async ({
  page,
}) => {
  const menuButton = page.getByRole("button", { name: "Open navigation menu" });
  await menuButton.click();

  await page.keyboard.press("Escape");

  await expectClosed(page);
  await expect(menuButton).toBeFocused();
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
});

test("the close button closes the drawer", async ({ page }) => {
  await page.getByRole("button", { name: "Open navigation menu" }).click();

  await page.getByRole("button", { name: "Close navigation menu" }).click();

  await expectClosed(page);
});

test("a section link closes the drawer and jumps to the section", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Open navigation menu" }).click();

  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Sponsoring" })
    .click();

  await expectClosed(page);
  await expect(page).toHaveURL(/#sponsoring$/);
});

test("the page behind the open drawer holds still", async ({ page }) => {
  await page.getByRole("button", { name: "Open navigation menu" }).click();
  await expect(page.getByRole("dialog")).toBeInViewport({ ratio: 1 });

  await page.mouse.move(40, 400);
  await page.mouse.wheel(0, 600);

  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test("the drawer closes as the viewport reaches Tailwind's md, where the sidebar shows", async ({
  page,
}) => {
  await page.setViewportSize({ ...TABLET, width: TABLET.width - 1 });
  await page.getByRole("button", { name: "Open navigation menu" }).click();

  await page.setViewportSize(TABLET);

  await expectClosed(page);
  await expect(
    page
      .locator("aside")
      .filter({ has: page.getByRole("navigation", { name: "Page sections" }) }),
  ).toBeVisible();
});
