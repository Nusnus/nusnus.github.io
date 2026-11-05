/**
 * @file Vitest: one test project per package, each in its runtime, the contract
 * and the repository's tooling on Node, the worker in workerd and the site in
 * happy-dom, with the setup files' tests in each of those runtimes too; all run
 * in random order, under a timeout that holds on a loaded machine. Each test
 * starts with fresh mocks, globals and environment variables, and fails on any
 * console call, process warning or missing assertion. The run fails unless
 * istanbul measures full coverage of the measured files, and a failed run
 * leaves a record of its seed and failures.
 */

import { cloudflareTest } from "@cloudflare/vitest-plugin";
import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

import { BAKED_GITHUB_DATA_MODULE } from "./packages/site/src/github-data/snapshot/baked-github-data.ts";
import { FailedRunRecorder } from "./tests/suite/failed-run-recorder.ts";
import {
  MEASURED_FILES,
  SETUP_FILES,
  SETUP_TEST_FILES,
  TEST_FILES,
} from "./tests/suite/files.ts";
import { TEST_TIMEOUT_MS } from "./tests/suite/test-timeout.ts";
import { workspaceAliases } from "./tests/suite/workspace-aliases.ts";

// Wrangler warns that the worker's secret is missing unless .dev.vars, .env or
// the environment holds it, and it reads no Vitest setting; CI has none of
// them. The tests themselves get the stand-in binding below.
const STAND_IN_TOKEN = "test-token";
process.env["GITHUB_TOKEN"] ??= STAND_IN_TOKEN;

// The worker's runtime, workerd, as its tests and its setup's tests run in it.
function workerRuntime() {
  return cloudflareTest({
    // A stand-in for the worker's secret, over any .dev.vars: the fake GitHub
    // accepts any token, and no test reaches the real one.
    miniflare: { bindings: { GITHUB_TOKEN: STAND_IN_TOKEN } },
    wrangler: { configPath: "./wrangler.jsonc" },
  });
}

export default defineConfig({
  // Each workspace package resolves to its folder in this checkout, so in
  // Stryker's sandbox every package's tests meet the mutants.
  resolve: { alias: workspaceAliases(import.meta.dirname) },
  test: {
    // A focused test left in a commit would skip every other test unseen.
    allowOnly: false,
    coverage: {
      exclude: [...MEASURED_FILES.exclude],
      include: [...MEASURED_FILES.include],
      // The Workers runtime has no V8 coverage, so every project uses istanbul:
      // https://developers.cloudflare.com/workers/testing/vitest-integration/known-issues/#coverage
      provider: "istanbul",
      thresholds: { 100: true },
    },
    // A test with no assertion cannot fail.
    expect: { requireAssertions: true },
    // Each project names the tiers it collects, since a project that extends
    // these settings adds its own include to any written here.
    projects: [
      {
        extends: true,
        test: {
          include: [...TEST_FILES],
          name: "github-data",
          root: "packages/github-data",
        },
      },
      {
        extends: true,
        plugins: [workerRuntime()],
        test: {
          include: [...TEST_FILES],
          name: "worker",
          root: "packages/worker",
        },
      },
      {
        extends: true,
        resolve: {
          // Only Astro's build serves these modules, so the tests serve fakes:
          // the fixture articles, and the contract's recorded replies, baked.
          alias: {
            "astro:content": path.join(
              import.meta.dirname,
              "packages/site/tests/fixtures/astro-content.ts",
            ),
            [BAKED_GITHUB_DATA_MODULE]: path.join(
              import.meta.dirname,
              "packages/site/tests/fixtures/baked-github-data.ts",
            ),
          },
        },
        test: {
          environment: "happy-dom",
          include: [...TEST_FILES],
          name: "site",
          root: "packages/site",
        },
      },
      // The setup files run in every runtime, which each holds its own
      // console and process, so their tests run in each package's runtime
      // too, as well as on Node with the repository's.
      {
        extends: true,
        plugins: [workerRuntime()],
        test: {
          include: [path.join(import.meta.dirname, SETUP_TEST_FILES)],
          name: "setup in workerd",
          root: "packages/worker",
        },
      },
      {
        extends: true,
        test: {
          environment: "happy-dom",
          include: [path.join(import.meta.dirname, SETUP_TEST_FILES)],
          name: "setup in happy-dom",
          root: "packages/site",
        },
      },
      {
        extends: true,
        test: { include: [...TEST_FILES], name: "repository" },
      },
    ],
    reporters: [
      // Vitest's default reporters, which depend on where it runs, and a
      // record of each failed run, which outlasts the run's output.
      ...configDefaults.reporters,
      new FailedRunRecorder(path.join(import.meta.dirname, "reports/vitest")),
    ],
    restoreMocks: true,
    sequence: { shuffle: true },
    setupFiles: SETUP_FILES.map((file) => path.join(import.meta.dirname, file)),
    testTimeout: TEST_TIMEOUT_MS,
    unstubEnvs: true,
    unstubGlobals: true,
  },
});
