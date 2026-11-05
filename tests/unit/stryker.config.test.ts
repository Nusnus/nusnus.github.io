/**
 * @file Mutation testing's settings: Stryker mutates the measured files, the
 * same ones coverage measures, and the setup files, runs each mutant with the
 * Vitest runner against every test, reuses the last run's result for each
 * mutant nothing changed, waits past the test timeout before it counts a
 * mutant as timed out, and fails unless every mutant is killed, writing its
 * JSON report beside its default reports. The mutation script names this
 * config, which Stryker finds by name only in JSON or JavaScript.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import settings from "../../stryker.config.ts";

describe("stryker.config", () => {
  it("mutates the measured and setup files, runs every test against each mutant with Vitest, reusing unchanged results, waits past the test timeout, fails unless every mutant is killed, and adds the JSON report", () => {
    expect(settings).toStrictEqual({
      incremental: true,
      mutate: [
        "packages/*/src/**/*.{ts,tsx}",
        "packages/*/tests/fixtures/**/*.ts",
        "packages/*/scripts/recording.ts",
        "scripts/**/*.ts",
        "tests/fixtures/**/*.ts",
        "tests/setup/**/*.ts",
        "tests/suite/**/*.ts",
        "!packages/site/tests/fixtures/smoke-page.ts",
        "!packages/site/tests/fixtures/worker/replay/main.ts",
        "!scripts/**/main.ts",
      ],
      plugins: ["@stryker-mutator/vitest-runner"],
      reporters: ["clear-text", "progress", "html", "json"],
      testRunner: "vitest",
      thresholds: { break: 100 },
      timeoutMS: 60_000,
      vitest: { related: false },
    });
  });
});

describe("the mutation script", () => {
  it("runs Stryker with this config", () => {
    const { scripts } = JSON.parse(
      readFileSync(
        path.join(import.meta.dirname, "../../package.json"),
        "utf8",
      ),
    ) as { scripts: Record<string, string> };

    expect(scripts["test:mutation"]).toBe("stryker run stryker.config.ts");
  });
});
