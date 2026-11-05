/**
 * @file The check:pinned-tools script: it runs the pinned-tools check on the
 * repository it runs in, with the running Node.js, reports each mismatch on
 * stderr and exits with the check's code.
 */

import { checkPinnedTools } from "./check.ts";

process.exitCode = checkPinnedTools(
  process.cwd(),
  process.env,
  process.versions.node,
  (line) => {
    console.error(line);
  },
);
