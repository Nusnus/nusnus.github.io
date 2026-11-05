/**
 * @file The test-mirror check runs on a git repository with the real git and
 * Vitest: it passes when each test mirrors a file and Vitest collects it,
 * reports each test outside a tier, mirroring no file, or missed by the
 * repository's own include, and says through its exit code whether any was.
 */

import { writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { runGit } from "../../../../scripts/git.ts";
import { checkTestMirrors } from "../../../../scripts/test-mirrors/check.ts";
import { temporaryFolder } from "../../../fixtures/temporary-folder.ts";

const SUITE_FILES = path.join(import.meta.dirname, "../../../suite/files.ts");
const MIRRORED_FILES = [
  "packages/site/src/page.ts",
  "packages/site/tests/unit/page.test.ts",
];
const MISPLACED_FILES = [
  "packages/site/tests/unit/missing.test.ts",
  "stray.test.ts",
];
const MISPLACED_REPORTS = [
  "packages/site/tests/unit/missing.test.ts mirrors no file: it would mirror packages/site/src/missing.<ext> or packages/site/tests/missing.<ext>. Rename or move it to mirror the file it tests.",
  "stray.test.ts is not in a tier folder: move it to <package>/tests/<tier>/, or to tests/<tier>/ at the repository root, where the tier is unit or integration, mirroring the file it tests.",
];

function createRepository(filePaths: readonly string[]): string {
  const root = temporaryFolder(
    "test-mirrors",
    Object.fromEntries(filePaths.map((filePath) => [filePath, ""])),
  );
  runGit(root, ["init", "--quiet"]);
  return root;
}

async function runCheck(
  root: string,
): Promise<{ exitCode: number; reports: string[] }> {
  const reports: string[] = [];
  const exitCode = await checkTestMirrors(root, (message) =>
    reports.push(message),
  );
  return { exitCode, reports: reports.toSorted() };
}

describe("checkTestMirrors", () => {
  it("passes when every test mirrors a file and Vitest collects it", async () => {
    await expect(
      runCheck(createRepository(MIRRORED_FILES)),
    ).resolves.toStrictEqual({
      exitCode: 0,
      reports: [],
    });
  });

  it("reports each test outside a tier or mirroring no file, and fails", async () => {
    const root = createRepository([...MIRRORED_FILES, ...MISPLACED_FILES]);

    await expect(runCheck(root)).resolves.toStrictEqual({
      exitCode: 1,
      reports: MISPLACED_REPORTS,
    });
  });

  it("reports each test the repository's own include does not collect, and fails", async () => {
    const root = createRepository([
      "page.ts",
      "tests/unit/page.test.ts",
      "tests/unit/page.test.js",
      "tests/units/page.test.ts",
    ]);
    writeFileSync(
      path.join(root, "vitest.config.mts"),
      `import { TEST_FILES } from ${JSON.stringify(SUITE_FILES)};\nexport default { test: { include: [...TEST_FILES] } };\n`,
    );

    await expect(runCheck(root)).resolves.toStrictEqual({
      exitCode: 1,
      reports: [
        "Vitest does not collect tests/unit/page.test.js, so it never runs: move or rename it to match the include in the Vitest config.",
        "Vitest does not collect tests/units/page.test.ts, so it never runs: move or rename it to match the include in the Vitest config.",
        "tests/units/page.test.ts is not in a tier folder: move it to <package>/tests/<tier>/, or to tests/<tier>/ at the repository root, where the tier is unit or integration, mirroring the file it tests.",
      ],
    });
  });
});
