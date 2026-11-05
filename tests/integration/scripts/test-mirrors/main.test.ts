/**
 * @file The test-mirror check runs as a script from another repository's
 * commit hook: it checks the repository it runs in, not the hook's, prints
 * each refusal to stderr and exits with status 1.
 */

import path from "node:path";
import { describe, expect, it } from "vitest";

import { runGit } from "../../../../scripts/git.ts";
import { runNodeScript } from "../../../fixtures/node-script.ts";
import { temporaryFolder } from "../../../fixtures/temporary-folder.ts";

const SCRIPT = path.join(
  import.meta.dirname,
  "../../../../scripts/test-mirrors/main.ts",
);

describe("the script", () => {
  it("checks the repository it runs in, not the hook's, prints each refusal to stderr and exits with status 1", async ({
    signal: testSignal,
  }) => {
    // The hook's repository holds a test that mirrors nothing, which the check
    // reports only if it reads that repository.
    const hookRepository = temporaryFolder("hook-repository", {
      "tests/unit/ghost.test.ts": "",
    });
    runGit(hookRepository, ["init", "--quiet"]);
    runGit(hookRepository, ["add", "."]);
    const hookGitDir = path.join(hookRepository, ".git");
    const root = temporaryFolder("test-mirrors", { "stray.test.ts": "" });
    runGit(root, ["init", "--quiet"]);

    const { signal, status, stderr } = await runNodeScript(SCRIPT, [], {
      cwd: root,
      // The variables git hands a hook that runs in a worktree.
      env: {
        ...process.env,
        GIT_DIR: hookGitDir,
        GIT_INDEX_FILE: path.join(hookGitDir, "index"),
        GIT_PREFIX: "",
      },
      signal: testSignal,
    });

    expect({ signal, status, stderr }).toStrictEqual({
      signal: null,
      status: 1,
      stderr:
        "stray.test.ts is not in a tier folder: move it to <package>/tests/<tier>/, or to tests/<tier>/ at the repository root, where the tier is unit or integration, mirroring the file it tests.\n",
    });
  });
});
