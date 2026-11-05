/**
 * @file The pinned-tools check: it fails unless every tool `mise.toml` pins
 * runs at its pinned version, and TypeScript targets the pinned Node.js, so
 * every machine checks the project with the tools CI uses. `check` runs it
 * before every other check. It asks mise, which owns `mise.toml` and
 * `mise.lock`, for the pins, finds each tool on PATH as a shell does, and
 * reads `package.json`.
 */

import { execFileSync } from "node:child_process";
import { accessSync, constants, readFileSync, realpathSync } from "node:fs";
import path from "node:path";

import {
  describeNodeTargetMismatch,
  describeRuntimeMismatches,
  describeToolMismatch,
  type FoundTool,
  parsePins,
  PinCheckError,
  runningBunVersion,
} from "./mismatches.ts";

// mise lists the pins from its local state within a second; one that takes
// this long is stuck.
const MISE_TIMEOUT_MS = 10_000;

export function checkPinnedTools(
  root: string,
  env: NodeJS.ProcessEnv,
  nodeVersion: string,
  report: (line: string) => void,
): number {
  try {
    const bunVersion = runningBunVersion(env);
    const { runtimes, tools } = parsePins(listMiseTools(root, env));
    const mismatches = [
      ...describeRuntimeMismatches(runtimes, {
        bun: bunVersion,
        node: nodeVersion,
      }),
      ...Object.entries(tools).flatMap(([tool, pin]) =>
        // mise ran, so PATH is set: Node found mise through it.
        describeToolMismatch(tool, pin, findOnPath(tool, String(env["PATH"]))),
      ),
      ...describeNodeTargetMismatch(
        runtimes.node,
        JSON.parse(
          // JSON.parse reads a buffer as its UTF-8 text, so no test tells the
          // encoding's removal apart.
          // Stryker disable next-line StringLiteral
          readFileSync(path.join(root, "package.json"), "utf8"),
        ),
      ),
    ];
    for (const mismatch of mismatches) {
      report(mismatch);
    }
    return mismatches.length === 0 ? 0 : 1;
  } catch (error) {
    if (!(error instanceof PinCheckError)) {
      throw error;
    }
    report(error.message);
    return 1;
  }
}

function listMiseTools(root: string, env: NodeJS.ProcessEnv): unknown {
  try {
    return JSON.parse(
      execFileSync("mise", ["ls", "--project", "--json"], {
        cwd: root,
        // JSON.parse reads a buffer as its UTF-8 text, so no test tells the
        // encoding's removal apart.
        // Stryker disable next-line StringLiteral
        encoding: "utf8",
        env,
        // mise's error output travels in the error, not beside it. Only a
        // terminal shows the difference, so no test tells the setting's
        // removal apart.
        // Stryker disable next-line StringLiteral
        stdio: "pipe",
        timeout: MISE_TIMEOUT_MS,
      }),
    );
  } catch (error) {
    // The one failure planned for: no mise to ask. Any other is a bug.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new PinCheckError(
        "mise, which installs the tools mise.toml pins, is not on PATH. Install it (https://mise.jdx.dev/installing-mise.html), then run `mise install`.",
      );
    }
    throw error;
  }
}

// The first executable file of the tool's name in a folder PATH lists, as a
// shell finds it: https://pubs.opengroup.org/onlinepubs/9799919799/basedefs/V1_chap08.html#tag_08_03
export function findOnPath(
  tool: string,
  searchPath: string,
): FoundTool | undefined {
  for (const folder of searchPath.split(path.delimiter)) {
    const file = path.join(folder, tool);
    try {
      accessSync(file, constants.X_OK);
    } catch {
      // Not in this folder, or not executable: the shell looks on.
      continue;
    }
    return { file, realPath: realpathSync(file) };
  }
  return undefined;
}
