/**
 * @file Runs a Node.js script in a child process, as a terminal or CI runs it,
 * and gives back how it ended and what it printed. The child runs alongside
 * the test, so the test's own timeout bounds it: once the test's signal aborts,
 * the child is killed and the run fails.
 */

import { spawn } from "node:child_process";
import { once } from "node:events";

/** How a script's process ended, and what it printed. */
export interface ScriptRun {
  readonly signal: NodeJS.Signals | null;
  readonly status: null | number;
  readonly stderr: string;
  readonly stdout: string;
}

/** Where and how a script runs, and the signal that ends it early. */
export interface ScriptOptions {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly signal: AbortSignal;
}

export async function runNodeScript(
  script: string,
  args: readonly string[],
  { cwd, env, signal }: ScriptOptions,
): Promise<ScriptRun> {
  const child = spawn(process.execPath, [script, ...args], {
    cwd,
    env,
    signal,
  });
  let stdout = "";
  let stderr = "";
  // A stream's decoder reads an empty encoding as UTF-8, so no test tells
  // the encoding's removal apart.
  // Stryker disable next-line StringLiteral
  child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
    stdout += chunk;
  });
  // As for the output above, no test tells the encoding's removal apart.
  // Stryker disable next-line StringLiteral
  child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
    stderr += chunk;
  });
  const [status, exitSignal] = (await once(child, "close")) as [
    null | number,
    NodeJS.Signals | null,
  ];
  return { signal: exitSignal, status, stderr, stdout };
}
