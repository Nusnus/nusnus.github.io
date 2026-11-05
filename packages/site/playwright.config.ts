/**
 * @file Playwright: runs the smoke tests in Chromium against the built site,
 * served by Astro's preview and baked from a replay of the contract's
 * recorded worker replies, each test on its own, and refuses focused tests. On
 * CI it prints dots and the shuffle seed, annotates each failure and writes an
 * HTML report; elsewhere it keeps Playwright's default reporter.
 */

import { WORKER_ROUTES } from "@nusnus/github-data/routes";
import { defineConfig, devices } from "@playwright/test";

import { PREVIEW, WORKER_REPLAY } from "./tests/fixtures/servers.ts";

export default defineConfig({
  forbidOnly: true,
  // --shuffle orders whole test groups, and a file's tests form one group
  // unless they run in parallel, so each runs on its own.
  fullyParallel: true,
  projects: [{ name: "chromium", use: devices["Desktop Chrome"] }],
  ...(process.env["CI"] === undefined
    ? {}
    : {
        // Dots are Playwright's CI default, and print the shuffle seed, which
        // the github reporter leaves out.
        reporter: [["dot"], ["github"], ["html", { open: "never" }]],
      }),
  testDir: "tests/smoke",
  // axe's scan of the home page, the largest, can outlast Playwright's default
  // of 30 seconds once checks running in several checkouts load the machine,
  // so each test gets three times that.
  timeout: 90_000,
  use: { baseURL: PREVIEW.url },
  webServer: [
    {
      command: `node tests/fixtures/worker/replay/main.ts ${String(WORKER_REPLAY.port)}`,
      url: WORKER_ROUTES.profile.urlAt(WORKER_REPLAY.url).href,
    },
    {
      // The site bakes in the replayed replies, and its pages refresh from
      // them. Astro runs preview in the background when an AI agent runs it.
      // Its docs say only that --ignore-lock skips the lock file, but its
      // source also keeps the server in the foreground then, so Playwright
      // stops it when the tests end: https://github.com/withastro/astro/issues/17903
      command: `bun run build && bun run preview --ignore-lock --port ${String(PREVIEW.port)}`,
      env: { WORKER_ORIGIN: WORKER_REPLAY.url },
      // Building takes longer than Playwright's default of a minute under the
      // load of the full check.
      timeout: 180_000,
      url: PREVIEW.url,
    },
  ],
});
