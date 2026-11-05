/**
 * @file temporaryFolder makes an empty folder, or one holding the files a test
 * names, nested ones too, under its real path, and removes it once the test
 * finishes.
 */

import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, onTestFinished } from "vitest";

import { temporaryFolder } from "../../fixtures/temporary-folder.ts";

describe("temporaryFolder", () => {
  it("makes an empty folder in the temporary folder, named after the prefix, under its real path", () => {
    const folder = temporaryFolder("empty");

    expect({
      entries: readdirSync(folder),
      name: path.basename(folder).startsWith("empty-"),
      parent: path.dirname(folder),
    }).toStrictEqual({
      entries: [],
      name: true,
      parent: realpathSync(os.tmpdir()),
    });
  });

  it("holds each file the test names, nested ones too", () => {
    const folder = temporaryFolder("files", {
      "page.ts": "export {};\n",
      "src/deep/note.md": "# Note\n",
    });

    expect([
      readFileSync(path.join(folder, "page.ts"), "utf8"),
      readFileSync(path.join(folder, "src/deep/note.md"), "utf8"),
    ]).toStrictEqual(["export {};\n", "# Note\n"]);
  });

  it("removes the folder once the test finishes", () => {
    let folder = "";
    // Vitest runs a test's finished hooks in the reverse of the order they
    // were added, so this one runs after the folder's removal.
    onTestFinished(() => {
      expect(existsSync(folder)).toBe(false);
    });

    folder = temporaryFolder("removed", { "page.ts": "" });

    expect(existsSync(folder)).toBe(true);
  });
});
