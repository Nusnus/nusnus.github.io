/**
 * @file The await:worker-version script, which the Deploy workflow runs once
 * it has deployed the worker: it waits for the version WORKER_VERSION_ID names
 * on the real network and clock, prints what it found and exits with the
 * wait's code.
 */

import { SYSTEM_TIMING } from "../../packages/site/src/github-data/snapshot/worker-client.ts";
import { awaitWorkerVersion } from "./wait.ts";

process.exitCode = await awaitWorkerVersion(
  process.env,
  { ...SYSTEM_TIMING, fetch },
  (line) => {
    console.log(line);
  },
);
