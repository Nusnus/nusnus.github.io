/**
 * @file The check:expiries script, which the Check expiries workflow runs: it
 * runs the expiry check with the process's environment variables, the Node.js
 * it runs on and the current time, prints its report and exits with its code.
 */

import { checkExpiries } from "./check.ts";

const { exitCode, lines } = await checkExpiries(
  process.versions.node,
  process.env,
  new Date(),
);
for (const line of lines) {
  console.log(line);
}
process.exitCode = exitCode;
