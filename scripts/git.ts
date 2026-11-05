/**
 * @file Runs git in a given folder, on the repository that folder is in,
 * whatever repository started this process.
 *
 * Git hands its hooks variables tied to the repository that runs them, such as
 * `GIT_DIR` and `GIT_INDEX_FILE` (https://git-scm.com/docs/githooks), and a
 * child git that inherits them acts on that repository whatever folder it runs
 * in. So each git this module runs gets this process's environment without the
 * variables `git rev-parse --local-env-vars` lists, git's own list of them.
 */

import { execFileSync } from "node:child_process";

// git answers the commands the scripts and tests run within a second; one
// that takes this long is stuck, such as on a lock or a prompt.
const GIT_TIMEOUT_MS = 10_000;

// git's own list changes only with git's version, so each process asks for it
// once, as it loads this module, which every importer loads to run git.
const REPOSITORY_VARIABLES: ReadonlySet<string> = new Set(
  execFileSync("git", ["rev-parse", "--local-env-vars"], {
    encoding: "utf8",
    timeout: GIT_TIMEOUT_MS,
  }).split("\n"),
);

export function runGit(folder: string, args: readonly string[]): string {
  return execFileSync("git", args, {
    cwd: folder,
    encoding: "utf8",
    env: withoutRepositoryVariables(process.env),
    timeout: GIT_TIMEOUT_MS,
  });
}

function withoutRepositoryVariables(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(env).filter(([name]) => !REPOSITORY_VARIABLES.has(name)),
  );
}
