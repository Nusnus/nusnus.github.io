/**
 * @file A temporary folder for one test, holding the files the test names and
 * removed once the test finishes. Its path is the folder's real path, as
 * tools such as Vitest and git name the files in it, since macOS's temporary
 * folder is a symlink.
 */

import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { onTestFinished } from "vitest";

export function temporaryFolder(
  prefix: string,
  files: Readonly<Record<string, string>> = {},
): string {
  const folder = realpathSync(
    mkdtempSync(path.join(os.tmpdir(), `${prefix}-`)),
  );
  onTestFinished(() => {
    rmSync(folder, { recursive: true });
  });
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(folder, name)), { recursive: true });
    writeFileSync(path.join(folder, name), content);
  }
  return folder;
}
