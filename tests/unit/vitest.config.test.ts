/**
 * @file The suite's settings: each package's tests run in that package's
 * runtime, collected from its unit and integration tiers, with the contract
 * resolved to its source in the checkout that runs them, and the setup files'
 * tests run in each package's runtime too, in random order under a printed
 * seed; they refuse focused tests, fail on any console call or process warning
 * and on a test with no assertion, and start with fresh mocks, globals and
 * environment variables, under one timeout, longer than Vitest's default. The
 * run fails unless the test script turns istanbul on and it measures full
 * coverage of the source, the test fixtures and the suite's own code, merged
 * across packages; a failed run leaves a record.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { configDefaults } from "vitest/config";
import { createVitest } from "vitest/node";

const ROOT = path.join(import.meta.dirname, "../..");
const COVERAGE_EXCLUDE = [
  "packages/site/tests/fixtures/smoke-page.ts",
  "packages/site/tests/fixtures/worker/replay/main.ts",
  "scripts/**/main.ts",
  // Vitest adds the rest, for the root and each project: the setup files, the
  // test files, its default ones included, its config files, virtual modules
  // and node_modules.
  "tests/setup/console-calls.ts",
  "tests/setup/process-warnings.ts",
  "../../tests/setup/console-calls.ts",
  "../../tests/setup/process-warnings.ts",
  "**/*.{test,spec}.?(c|m)[jt]s?(x)",
  "tests/unit/**/*.test.{ts,tsx}",
  "tests/integration/**/*.test.{ts,tsx}",
  path.join(ROOT, "tests/unit/setup/*.test.ts"),
  "vitest.config.ts",
  "vitest.config.mts",
  "vitest.config.cts",
  "vitest.config.js",
  "vitest.config.mjs",
  "vitest.config.cjs",
  "vite.config.ts",
  "vite.config.mts",
  "vite.config.cts",
  "vite.config.js",
  "vite.config.mjs",
  "vite.config.cjs",
  "**/virtual:*",
  "**/__x00__*",
  "**/node_modules/**",
];
const BOTH_TIERS = [
  "tests/unit/**/*.test.{ts,tsx}",
  "tests/integration/**/*.test.{ts,tsx}",
];
const EACH_TEST = {
  allowOnly: false,
  requireAssertions: true,
  restoreMocks: true,
  setupFiles: [
    path.join(ROOT, "tests/setup/console-calls.ts"),
    path.join(ROOT, "tests/setup/process-warnings.ts"),
  ],
  shuffle: true,
  unstubEnvs: true,
  unstubGlobals: true,
};
const { coverage, projects, reporters } = await resolveSettings();

async function resolveSettings() {
  const vitest = await createVitest({ root: ROOT });
  await vitest.close();
  return {
    coverage: vitest.config.coverage,
    projects: vitest.projects.map(({ config, name, vite }) => ({
      // Vite adds aliases of its own, whose find is a pattern.
      aliases: vite.config.resolve.alias.filter(
        ({ find }) => typeof find === "string",
      ),
      config,
      name,
    })),
    reporters: vitest.config.reporters,
  };
}

describe("vitest.config", () => {
  it("runs each package's tests in its runtime, from its own root, the setup files' tests in each runtime too, and the repository's own", () => {
    expect(
      projects.map(({ config, name }) => ({
        environment: config.environment,
        name,
        pool: config.pool,
        root: path.relative(ROOT, config.root),
      })),
    ).toStrictEqual([
      {
        environment: "node",
        name: "github-data",
        pool: "forks",
        root: "packages/github-data",
      },
      {
        environment: "node",
        name: "worker",
        pool: "cloudflare-pool",
        root: "packages/worker",
      },
      {
        environment: "happy-dom",
        name: "site",
        pool: "forks",
        root: "packages/site",
      },
      {
        environment: "node",
        name: "setup in workerd",
        pool: "cloudflare-pool",
        root: "packages/worker",
      },
      {
        environment: "happy-dom",
        name: "setup in happy-dom",
        pool: "forks",
        root: "packages/site",
      },
      { environment: "node", name: "repository", pool: "forks", root: "" },
    ]);
  });

  it("resolves the contract's exports to its folder in this checkout in every project, and the site's baked data and articles to their fixtures", () => {
    const contractAliases = [
      {
        find: "@nusnus/github-data/fixtures",
        replacement: path.join(ROOT, "packages/github-data/tests/fixtures"),
      },
      {
        find: "@nusnus/github-data",
        replacement: path.join(ROOT, "packages/github-data/src"),
      },
    ];

    expect(projects.map(({ aliases }) => aliases)).toStrictEqual([
      contractAliases,
      contractAliases,
      [
        {
          find: "astro:content",
          replacement: path.join(
            ROOT,
            "packages/site/tests/fixtures/astro-content.ts",
          ),
        },
        {
          find: "virtual:baked-github-data",
          replacement: path.join(
            ROOT,
            "packages/site/tests/fixtures/baked-github-data.ts",
          ),
        },
        ...contractAliases,
      ],
      contractAliases,
      contractAliases,
      contractAliases,
    ]);
  });

  it("collects the tests in each package's unit and integration tiers, the repository's included, and the setup files' tests in each package's runtime", () => {
    expect(projects.map(({ config }) => config.include)).toStrictEqual([
      BOTH_TIERS,
      BOTH_TIERS,
      BOTH_TIERS,
      [path.join(ROOT, "tests/unit/setup/*.test.ts")],
      [path.join(ROOT, "tests/unit/setup/*.test.ts")],
      BOTH_TIERS,
    ]);
  });

  it("shuffles, refuses focused tests, fails on console calls, process warnings and tests with no assertion, and restores mocks, globals and environment variables in every project", () => {
    expect(
      projects.map(({ config }) => ({
        allowOnly: config.allowOnly,
        requireAssertions: config.expect.requireAssertions,
        restoreMocks: config.restoreMocks,
        setupFiles: config.setupFiles,
        shuffle: config.sequence.shuffle,
        unstubEnvs: config.unstubEnvs,
        unstubGlobals: config.unstubGlobals,
      })),
    ).toStrictEqual([
      EACH_TEST,
      EACH_TEST,
      EACH_TEST,
      EACH_TEST,
      EACH_TEST,
      EACH_TEST,
    ]);
  });

  it("gives each test in every project a minute", () => {
    expect(projects.map(({ config }) => config.testTimeout)).toStrictEqual([
      60_000, 60_000, 60_000, 60_000, 60_000, 60_000,
    ]);
  });

  it("reports through Vitest's default reporters, and records each failed run in reports/vitest", () => {
    // Vitest's defaults depend on where it runs, adding a GitHub Actions
    // reporter on CI, so they come from Vitest rather than a literal, which
    // would have to branch on the environment.
    expect(reporters).toStrictEqual([
      ...configDefaults.reporters.map((name) => [name, {}]),
      expect.objectContaining({
        constructor: expect.objectContaining({
          name: "FailedRunRecorder",
        }) as unknown,
        folder: path.join(ROOT, "reports/vitest"),
      }) as unknown,
    ]);
  });

  it("requires istanbul to measure full coverage of the source, the test fixtures and the suite's own code, but for the modules only Astro's build, Playwright or a script's own process loads", () => {
    expect({
      exclude: new Set(coverage.exclude),
      include: coverage.include,
      provider: coverage.provider,
      thresholds: coverage.thresholds,
    }).toStrictEqual({
      exclude: new Set(COVERAGE_EXCLUDE),
      include: [
        "packages/*/src/**/*.{ts,tsx}",
        "packages/*/tests/fixtures/**/*.ts",
        "packages/*/scripts/recording.ts",
        "scripts/**/*.ts",
        "tests/fixtures/**/*.ts",
        "tests/setup/**/*.ts",
        "tests/suite/**/*.ts",
      ],
      provider: "istanbul",
      thresholds: { 100: true },
    });
  });
});

describe("the test script", () => {
  it("runs Vitest with coverage, which turns the coverage settings on", () => {
    const { scripts } = JSON.parse(
      readFileSync(path.join(ROOT, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };

    expect(scripts["test"]).toBe("vitest run --coverage");
  });
});
