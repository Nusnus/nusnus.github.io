/**
 * @file The built page's theme: the visitor's pick shows from the first paint
 * and survives a reload; without a pick, the page follows the OS setting, live;
 * and each width shows one theme toggle.
 */

import { expect, test, VIEWPORTS } from "../fixtures/smoke-page.ts";

const isDark = () => document.documentElement.classList.contains("dark");

test("the picked theme is on the page before its body renders", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() => {
    localStorage.setItem("theme", "dark");
    new MutationObserver((_, observer) => {
      if (document.querySelector("body") !== null) {
        document.documentElement.dataset["themeAtBody"] =
          document.documentElement.className;
        observer.disconnect();
      }
    }).observe(document, { childList: true, subtree: true });
  });

  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute(
    "data-theme-at-body",
    "dark",
  );
});

test("without a pick, the page follows the OS setting as it changes", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  expect(await page.evaluate(isDark)).toBe(true);

  await page.emulateMedia({ colorScheme: "light" });

  await expect.poll(() => page.evaluate(isDark)).toBe(false);
});

test("the theme toggle switches the theme, and the pick survives a reload", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");

  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await page.reload();

  expect(await page.evaluate(isDark)).toBe(false);
  await expect(
    page.getByRole("button", { name: "Switch to dark mode" }),
  ).toBeVisible();
});

for (const viewport of VIEWPORTS) {
  test(`at ${String(viewport.width)}px, the page shows one theme toggle`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");

    await expect(
      page.getByRole("button", { name: /^Switch to (?:light|dark) mode$/ }),
    ).toBeVisible();
    await expect(page.locator("[data-theme-toggle]:visible")).toHaveCount(1);
  });
}
