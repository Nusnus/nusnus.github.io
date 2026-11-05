/**
 * @file What the test-mirror check refuses, from the files git tracks or would
 * track and the tests Vitest collects. A test file is any whose name Vitest's
 * default include takes for a test, such as `page.test.ts` or
 * `page.spec.tsx`, so the check also finds the tests the repository's own
 * include misses. A test at `<package>/tests/<tier>/<path>.test.<ext>`, where
 * the tier is `unit` or `integration`, mirrors the source file
 * `<package>/src/<path>.<any ext>`, or `<path>.<any ext>` at the repository
 * root, which has no `src/`; a test of a shared test helper mirrors the
 * helper's path under `tests/`. The check refuses each test file outside a
 * tier folder, each that mirrors no file, and each Vitest does not collect;
 * the include in `vitest.config.ts` names the tiers Vitest collects. It skips
 * the smoke tests, in `tests/smoke/`: they test the built site rather than one
 * file, and Playwright runs them.
 */

import path from "node:path";
import { configDefaults } from "vitest/config";

const SMOKE_TEST = /^(?:packages\/[^/]+\/)?tests\/smoke\//;
const TIERED_TEST =
  /^(?<packageRoot>packages\/[^/]+\/)?tests\/(?:unit|integration)\/(?<mirroredPath>.+)\.(?:test|spec)\./;

export function findRefusals(
  filePaths: readonly string[],
  collectedTestPaths: readonly string[],
): string[] {
  const fileStems = new Set(filePaths.map(withoutExtension));
  const collected = new Set(collectedTestPaths);
  return filePaths
    .filter((filePath) => isTestFile(filePath) && !SMOKE_TEST.test(filePath))
    .flatMap((testPath) => {
      const refusals: string[] = [];
      const stems = mirrorableStems(testPath);
      if (stems.length === 0) {
        refusals.push(
          `${testPath} is not in a tier folder: move it to <package>/tests/<tier>/, or to tests/<tier>/ at the repository root, where the tier is unit or integration, mirroring the file it tests.`,
        );
      } else if (!stems.some((stem) => fileStems.has(stem))) {
        const mirrorable = stems.map((stem) => `${stem}.<ext>`).join(" or ");
        refusals.push(
          `${testPath} mirrors no file: it would mirror ${mirrorable}. Rename or move it to mirror the file it tests.`,
        );
      }
      if (!collected.has(testPath)) {
        refusals.push(
          `Vitest does not collect ${testPath}, so it never runs: move or rename it to match the include in the Vitest config.`,
        );
      }
      return refusals;
    });
}

function isTestFile(filePath: string): boolean {
  // Vitest's default include holds one pattern, so `every` would match as
  // `some` does.
  // Stryker disable next-line MethodExpression
  return configDefaults.include.some((pattern) =>
    path.matchesGlob(filePath, pattern),
  );
}

function mirrorableStems(testPath: string): string[] {
  const groups = TIERED_TEST.exec(testPath)?.groups;
  if (groups?.["mirroredPath"] === undefined) {
    return [];
  }
  const packageRoot = groups["packageRoot"] ?? "";
  const sourceRoot = packageRoot === "" ? "" : `${packageRoot}src/`;
  return [
    `${sourceRoot}${groups["mirroredPath"]}`,
    `${packageRoot}tests/${groups["mirroredPath"]}`,
  ];
}

function withoutExtension(filePath: string): string {
  return filePath.slice(0, filePath.length - path.extname(filePath).length);
}
