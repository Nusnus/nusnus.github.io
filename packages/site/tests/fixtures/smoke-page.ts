/**
 * @file The smoke tests' page: Playwright's `test`, whose page fails the test
 * on any console message or uncaught page error, but those the test lists in
 * `expectedProblems`, in order; the viewports the tests visit; axe's
 * accessibility check, of a page or a part of it; and the checks every page
 * passes, at each viewport and in both themes: axe finds no violation, and the
 * skip link moves focus to the main content.
 */

import { AxeBuilder } from "@axe-core/playwright";
import { test as base, expect, type Page } from "@playwright/test";

import { THEMES } from "../../src/theme/theme.ts";
import { PageProblems } from "./page-problems.ts";

export { expect };

// A phone, then a tablet, a small laptop and a desktop at Tailwind's md, lg
// and 2xl breakpoints.
export const VIEWPORTS = [
  { height: 812, width: 375 },
  { height: 1024, width: 768 },
  { height: 768, width: 1024 },
  { height: 960, width: 1536 },
] as const;

export const test = base.extend<{ expectedProblems: readonly string[] }>({
  expectedProblems: [[], { option: true }],
  page: async ({ expectedProblems, page }, use) => {
    const { problems } = new PageProblems(page);

    await use(page);

    expect(problems).toStrictEqual(expectedProblems);
  },
});

export function pageChecks(path: string, name: string): void {
  for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
      test(`at ${String(viewport.width)}px in the ${theme} theme, ${name} has no accessibility violations`, async ({
        page,
      }) => {
        await page.setViewportSize(viewport);
        await page.emulateMedia({
          colorScheme: theme,
          // A value fading in mid-animation is not low in contrast once it
          // settles; axe judges the settled page.
          reducedMotion: "reduce",
        });
        await page.goto(path);

        await expectAccessible(page);
      });
    }

    test(`at ${String(viewport.width)}px, the skip link on ${name} moves focus to the main content`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto(path);

      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("link", { name: "Skip to main content" }),
      ).toBeFocused();
      await page.keyboard.press("Enter");

      await expect(page).toHaveURL(/#main-content$/);
      await expect(page.locator("main#main-content")).toBeInViewport();
    });
  }
}

export async function expectAccessible(
  page: Page,
  selector?: string,
): Promise<void> {
  const axe = new AxeBuilder({ page });
  const { violations } = await (
    selector === undefined ? axe : axe.include(selector)
  ).analyze();
  expect(violations).toStrictEqual([]);
}
