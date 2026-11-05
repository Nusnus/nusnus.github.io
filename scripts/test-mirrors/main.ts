/**
 * @file The check:test-mirrors script: it runs the test-mirror check on the
 * repository it runs in, reports each refusal on stderr and exits with the
 * check's code.
 */

import { checkTestMirrors } from "./check.ts";

process.exitCode = await checkTestMirrors(process.cwd(), (message) => {
  console.error(message);
});
