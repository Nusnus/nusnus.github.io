/**
 * @file findRefusals checks each file whose name Vitest's default include
 * takes for a test: it accepts each collected test that mirrors a file,
 * refuses each test outside a tier folder, each that mirrors no file and each
 * Vitest does not collect, and skips the smoke tests and every other file.
 */

import { describe, expect, it } from "vitest";

import { findRefusals } from "../../../../scripts/test-mirrors/refusals.ts";

describe("findRefusals", () => {
  it("accepts a package's collected test that mirrors its source file", () => {
    expect(
      findRefusals(
        [
          "packages/site/src/components/Card.tsx",
          "packages/site/tests/unit/components/Card.test.tsx",
        ],
        ["packages/site/tests/unit/components/Card.test.tsx"],
      ),
    ).toStrictEqual([]);
  });

  it("accepts a test whose extension differs from its source file's", () => {
    expect(
      findRefusals(
        [
          "packages/site/src/components/Card.astro",
          "packages/site/tests/unit/components/Card.test.ts",
        ],
        ["packages/site/tests/unit/components/Card.test.ts"],
      ),
    ).toStrictEqual([]);
  });

  it("accepts a repository-root test that mirrors a root file's whole name", () => {
    expect(
      findRefusals(
        ["tests/unit/vitest.config.test.ts", "vitest.config.ts"],
        ["tests/unit/vitest.config.test.ts"],
      ),
    ).toStrictEqual([]);
  });

  it("accepts a test in the repository root's tier folder", () => {
    expect(
      findRefusals(
        ["guide.md", "tests/unit/guide.test.ts"],
        ["tests/unit/guide.test.ts"],
      ),
    ).toStrictEqual([]);
  });

  it("accepts a test of a shared test helper", () => {
    expect(
      findRefusals(
        [
          "packages/worker/tests/fixtures/github.ts",
          "packages/worker/tests/unit/fixtures/github.test.ts",
        ],
        ["packages/worker/tests/unit/fixtures/github.test.ts"],
      ),
    ).toStrictEqual([]);
  });

  it("refuses a test whose source file does not exist", () => {
    expect(
      findRefusals(
        [
          "packages/site/src/components/Cards.tsx",
          "packages/site/tests/unit/components/Card.test.tsx",
        ],
        ["packages/site/tests/unit/components/Card.test.tsx"],
      ),
    ).toStrictEqual([
      "packages/site/tests/unit/components/Card.test.tsx mirrors no file: it would mirror packages/site/src/components/Card.<ext> or packages/site/tests/components/Card.<ext>. Rename or move it to mirror the file it tests.",
    ]);
  });

  it("refuses a test that mirrors only a file sharing its name's prefix", () => {
    expect(
      findRefusals(
        ["tests/unit/vitest.test.ts", "vitest.config.ts"],
        ["tests/unit/vitest.test.ts"],
      ),
    ).toStrictEqual([
      "tests/unit/vitest.test.ts mirrors no file: it would mirror vitest.<ext> or tests/vitest.<ext>. Rename or move it to mirror the file it tests.",
    ]);
  });

  it("refuses a tier folder outside a package and the repository root", () => {
    expect(
      findRefusals(
        ["docs/tests/unit/guide.test.ts", "guide.md"],
        ["docs/tests/unit/guide.test.ts"],
      ),
    ).toStrictEqual([
      "docs/tests/unit/guide.test.ts is not in a tier folder: move it to <package>/tests/<tier>/, or to tests/<tier>/ at the repository root, where the tier is unit or integration, mirroring the file it tests.",
    ]);
  });

  it("refuses a test in a folder of tests/ that is no tier, such as the shared helpers'", () => {
    expect(
      findRefusals(
        [
          "packages/site/tests/fixtures/servers.test.ts",
          "packages/site/tests/fixtures/servers.ts",
        ],
        ["packages/site/tests/fixtures/servers.test.ts"],
      ),
    ).toStrictEqual([
      "packages/site/tests/fixtures/servers.test.ts is not in a tier folder: move it to <package>/tests/<tier>/, or to tests/<tier>/ at the repository root, where the tier is unit or integration, mirroring the file it tests.",
    ]);
  });

  it("accepts a package's collected test in its integration tier", () => {
    expect(
      findRefusals(
        [
          "packages/worker/src/worker.ts",
          "packages/worker/tests/integration/worker.test.ts",
        ],
        ["packages/worker/tests/integration/worker.test.ts"],
      ),
    ).toStrictEqual([]);
  });

  it("refuses a test outside a tier folder", () => {
    expect(
      findRefusals(
        [
          "packages/site/src/components/Card.test.tsx",
          "packages/site/src/components/Card.tsx",
        ],
        ["packages/site/src/components/Card.test.tsx"],
      ),
    ).toStrictEqual([
      "packages/site/src/components/Card.test.tsx is not in a tier folder: move it to <package>/tests/<tier>/, or to tests/<tier>/ at the repository root, where the tier is unit or integration, mirroring the file it tests.",
    ]);
  });

  it("refuses a test Vitest does not collect", () => {
    expect(
      findRefusals(
        [
          "packages/site/src/components/Card.tsx",
          "packages/site/tests/unit/components/Card.test.tsx",
        ],
        [],
      ),
    ).toStrictEqual([
      "Vitest does not collect packages/site/tests/unit/components/Card.test.tsx, so it never runs: move or rename it to match the include in the Vitest config.",
    ]);
  });

  it("refuses each fault of a test that has several", () => {
    expect(findRefusals(["stray.spec.js"], [])).toStrictEqual([
      "stray.spec.js is not in a tier folder: move it to <package>/tests/<tier>/, or to tests/<tier>/ at the repository root, where the tier is unit or integration, mirroring the file it tests.",
      "Vitest does not collect stray.spec.js, so it never runs: move or rename it to match the include in the Vitest config.",
    ]);
  });

  it("skips a smoke test, which mirrors no file and which Vitest does not collect", () => {
    expect(
      findRefusals(
        ["packages/site/tests/smoke/home.test.ts", "tests/smoke/home.test.ts"],
        [],
      ),
    ).toStrictEqual([]);
  });

  it("refuses a smoke folder outside a package and the repository root", () => {
    expect(findRefusals(["docs/tests/smoke/home.test.ts"], [])).toStrictEqual([
      "docs/tests/smoke/home.test.ts is not in a tier folder: move it to <package>/tests/<tier>/, or to tests/<tier>/ at the repository root, where the tier is unit or integration, mirroring the file it tests.",
      "Vitest does not collect docs/tests/smoke/home.test.ts, so it never runs: move or rename it to match the include in the Vitest config.",
    ]);
  });

  it("skips each file whose name Vitest's default include does not take for a test", () => {
    expect(
      findRefusals(
        [
          "packages/site/tests/fixtures/servers.ts",
          "packages/site/tests/unit/home.test.json",
          "tests/unit/setup.tests.ts",
        ],
        [],
      ),
    ).toStrictEqual([]);
  });
});
