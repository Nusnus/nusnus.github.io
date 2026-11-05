/**
 * @file The smoke tier's settings: Playwright runs each smoke test on its own
 * and in random order, in Chromium, against the site's preview, on the port
 * PREVIEW_PORT names, baked from the worker replay; it gives each test longer
 * than its default and refuses focused tests. On CI it prints its default dots
 * with the shuffle seed, annotates failures and writes an HTML report, and
 * elsewhere it keeps its default reporter. The smoke tests' script installs
 * Playwright's Chromium before it runs them.
 *
 * These tests sit among the suite's settings tests, rather than in the site's
 * own tests, since a package's tests mirror only its `src/`.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const SITE = path.join(import.meta.dirname, "../../../../packages/site");
// Playwright is the site's dependency, not the repository's.
const { devices } = createRequire(path.join(SITE, "package.json"))(
  "@playwright/test",
) as { devices: Record<string, object> };
const SETTINGS_OFF_CI = {
  forbidOnly: true,
  fullyParallel: true,
  projects: [{ name: "chromium", use: devices["Desktop Chrome"] }],
  testDir: "tests/smoke",
  timeout: 90_000,
  use: { baseURL: "http://localhost:4411" },
  webServer: [
    {
      command: "node tests/fixtures/worker/replay/main.ts 5411",
      url: "http://localhost:5411/profile",
    },
    {
      command: "bun run build && bun run preview --ignore-lock --port 4411",
      env: { WORKER_ORIGIN: "http://localhost:5411" },
      timeout: 180_000,
      url: "http://localhost:4411",
    },
  ],
};

async function loadSettings(ci: string | undefined): Promise<object> {
  vi.stubEnv("CI", ci);
  vi.stubEnv("PREVIEW_PORT", "4411");
  vi.resetModules();
  const { default: settings } =
    await import("../../../../packages/site/playwright.config.ts");
  // defineConfig also marks the settings with a symbol of Playwright's own.
  return Object.fromEntries(Object.entries(settings));
}

describe("playwright.config", () => {
  it("runs each smoke test on its own in Chromium against the preview on the port PREVIEW_PORT names, baked from the worker replay on the port derived from it, gives each test longer than the default and refuses focused tests, with Playwright's default reporter off CI", async () => {
    await expect(loadSettings(undefined)).resolves.toStrictEqual(
      SETTINGS_OFF_CI,
    );
  });

  it("prints dots, annotates failures and writes an HTML report on CI", async () => {
    await expect(loadSettings("true")).resolves.toStrictEqual({
      ...SETTINGS_OFF_CI,
      reporter: [["dot"], ["github"], ["html", { open: "never" }]],
    });
  });
});

describe("the smoke tests' script", () => {
  it("installs Playwright's Chromium, then runs Playwright in random order", () => {
    const { scripts } = JSON.parse(
      readFileSync(path.join(SITE, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };

    expect(scripts["test:smoke"]).toBe(
      "playwright install --only-shell chromium && playwright test --shuffle",
    );
  });
});
