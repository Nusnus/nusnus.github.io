/**
 * @file runGit runs the real git in the folder it is given, never in the
 * repository a commit hook's variables name but with the rest of the hook's
 * environment, and returns git's output.
 */

import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { runGit } from "../../../scripts/git.ts";
import { temporaryFolder } from "../../fixtures/temporary-folder.ts";

describe("runGit", () => {
  it("runs git in the folder, not in the repository a commit hook's variables name, and returns its output", () => {
    const hookRepository = temporaryFolder("hook-repository");
    runGit(hookRepository, ["init", "--quiet"]);
    const hookGitDir = path.join(hookRepository, ".git");
    // The variables git hands a hook that runs in a worktree.
    vi.stubEnv("GIT_DIR", hookGitDir);
    vi.stubEnv("GIT_INDEX_FILE", path.join(hookGitDir, "index"));
    vi.stubEnv("GIT_PREFIX", "");
    const folder = temporaryFolder("repository", { "page.ts": "" });

    runGit(folder, ["init", "--quiet"]);
    runGit(folder, ["add", "page.ts"]);

    expect({
      folderFiles: runGit(folder, ["ls-files"]),
      hookFiles: runGit(hookRepository, ["ls-files"]),
    }).toStrictEqual({ folderFiles: "page.ts\n", hookFiles: "" });
  });

  it("keeps every other variable, such as the author a commit hook passes", () => {
    vi.stubEnv("GIT_AUTHOR_NAME", "Hook Author");
    vi.stubEnv("GIT_AUTHOR_EMAIL", "hook@example.com");
    vi.stubEnv("GIT_AUTHOR_DATE", "@0 +0000");

    expect(
      runGit(temporaryFolder("repository"), ["var", "GIT_AUTHOR_IDENT"]),
    ).toBe("Hook Author <hook@example.com> 0 +0000\n");
  });
});
