/**
 * @file StrykerJS: mutates the measured files, the setup files included, which
 * Vitest leaves out of its own coverage, runs each mutant against every Vitest
 * test that reaches it, whichever package holds the test, reusing the last
 * run's result for each mutant nothing changed, and fails unless every mutant
 * is killed.
 *
 * Stryker finds a config file by name only in JSON or JavaScript, so
 * `test:mutation` names this one, which Node runs by stripping its types.
 * Stryker's sandbox links its node_modules to the project's, so Vitest's
 * config resolves the workspace packages to the sandbox's own copies, as
 * `tests/suite/workspace-aliases.ts` says.
 */

import type { PartialStrykerOptions } from "@stryker-mutator/api/core";

import { MEASURED_FILES } from "./tests/suite/files.ts";

export default {
  // Each run reuses the result of each mutant whose code and tests are
  // unchanged since the run that wrote reports/stryker-incremental.json, and
  // writes the results it has so far there when stopped, so CI, which keeps
  // the file between runs, mutates only what changed, and a stopped run's
  // successor picks up where it stopped:
  // https://stryker-mutator.io/docs/stryker-js/incremental/
  incremental: true,
  mutate: [
    ...MEASURED_FILES.include,
    ...MEASURED_FILES.exclude.map((glob) => `!${glob}`),
  ],
  // Stryker's default loads the @stryker-mutator packages installed beside its
  // own, and Bun installs each package in a folder of its own.
  plugins: ["@stryker-mutator/vitest-runner"],
  // Naming any reporter replaces Stryker's default list, which this restates
  // before adding the JSON report, in the mutation-testing-report schema, for
  // tools that read the results.
  reporters: ["clear-text", "progress", "html", "json"],
  testRunner: "vitest",
  thresholds: { break: 100 },
  // Vitest finds a mutated file's related tests by their imports
  // (https://vitest.dev/guide/cli.html#vitest-related), and the settings tests
  // reach the suite's files through Vitest's config loader instead.
  vitest: { related: false },
} satisfies PartialStrykerOptions;
