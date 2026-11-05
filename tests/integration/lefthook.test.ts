/**
 * @file The commit hook's settings, as lefthook reads them: before each commit
 * it runs the project's full check, as a terminal or CI runs it.
 */

import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { runNodeScript } from "../fixtures/node-script.ts";

const ROOT = path.join(import.meta.dirname, "../..");
const LEFTHOOK = createRequire(import.meta.url).resolve(
  "lefthook/bin/index.js",
);

describe("lefthook", () => {
  it("runs bun run check, with nothing around it, before each commit", async ({
    signal,
  }) => {
    const { stdout } = await runNodeScript(
      LEFTHOOK,
      ["dump", "--format", "json"],
      { cwd: ROOT, signal },
    );
    const settings: unknown = JSON.parse(stdout);

    expect(settings).toStrictEqual({
      "pre-commit": { jobs: [{ name: "check", run: "bun run check" }] },
    });
  });
});
