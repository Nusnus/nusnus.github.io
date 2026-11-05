/**
 * @file The suite's files, for each tool that needs them: the test files
 * Vitest runs, in every tier, the setup files it runs before each test file,
 * and the measured files, whose coverage Vitest measures, but for the setup
 * files, and whose mutants Stryker runs.
 */

// Relative to each Vitest project's root, so each package's tiers and the
// repository's own match them.
export const TEST_FILES = [
  "tests/unit/**/*.test.{ts,tsx}",
  "tests/integration/**/*.test.{ts,tsx}",
] as const;

// The setup files' tests, relative to the repository's root, which each
// package's runtime runs too.
export const SETUP_TEST_FILES = "tests/unit/setup/*.test.ts";

export const SETUP_FILES = [
  "tests/setup/console-calls.ts",
  "tests/setup/process-warnings.ts",
] as const;

export const MEASURED_FILES = {
  exclude: [
    // Only Playwright loads these, for the smoke tests, which Vitest does not
    // run.
    "packages/site/tests/fixtures/smoke-page.ts",
    // Each entry only Node runs, in a child process neither coverage nor
    // mutation testing sees into: the worker replay's, which the smoke tests
    // start as Playwright's web server; each script's, which the script's
    // integration test starts; and the services' recorder's, which runs
    // against the live services, which only a person asks.
    "packages/site/tests/fixtures/worker/replay/main.ts",
    "scripts/**/main.ts",
  ],
  include: [
    "packages/*/src/**/*.{ts,tsx}",
    "packages/*/tests/fixtures/**/*.ts",
    // What both recorders share; the recorders themselves run only against
    // the live services, which only a person asks. Vitest reads a path with
    // no wildcard as a folder, so the package is one.
    "packages/*/scripts/recording.ts",
    "scripts/**/*.ts",
    "tests/fixtures/**/*.ts",
    // Vitest leaves its own setup files out of coverage, whatever its config
    // says, so only Stryker measures these.
    "tests/setup/**/*.ts",
    "tests/suite/**/*.ts",
  ],
} as const;
