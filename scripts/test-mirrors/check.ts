/**
 * @file The test-mirror check: each test file mirrors the path of the file it
 * tests, so a reader finds a file's tests, and a test's subject, from the path
 * alone, and Vitest runs it. It lists the files git tracks or would track, and
 * the tests Vitest collects, and reports each refusal `refusals.ts` finds.
 */

import path from "node:path";
import { createVitest } from "vitest/node";

import { runGit } from "../git.ts";
import { findRefusals } from "./refusals.ts";

export async function checkTestMirrors(
  root: string,
  report: (message: string) => void,
): Promise<number> {
  const refusals = findRefusals(
    listFilePaths(root),
    await listCollectedTests(root),
  );
  for (const refusal of refusals) {
    report(refusal);
  }
  return refusals.length === 0 ? 0 : 1;
}

function listFilePaths(root: string): string[] {
  // The output ends with a separator; the empty path after it is no test, and
  // no test mirrors it, so it stays.
  return runGit(root, [
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "-z",
  ]).split("\0");
}

async function listCollectedTests(root: string): Promise<string[]> {
  const vitest = await createVitest({ root });
  const specifications = await vitest.globTestSpecifications().finally(
    // Only the script's own process, which an open Vitest keeps from ending,
    // tells the closing apart, and mutation testing does not see into it.
    // Stryker disable next-line ArrowFunction
    () => vitest.close(),
  );
  return specifications.map(({ moduleId }) =>
    path.relative(vitest.config.root, moduleId),
  );
}
