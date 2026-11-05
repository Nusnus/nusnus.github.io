/**
 * @file The wait for a deployed worker version: it asks the worker for its
 * profile route until a response names that version in the contract's
 * version header, so the site's build that follows bakes the data the new
 * version serves, in the contract the site's code reads. Cloudflare documents
 * no time by which a new version serves every request, so the wait asks ever
 * less often, up to a limit, then fails, saying what the worker answered
 * last. It reads the version's id from WORKER_VERSION_ID, which the Deploy
 * workflow sets from Wrangler's report of its deploy.
 */

import { backoffCeilingMs } from "@nusnus/github-data/retries";
import {
  WORKER_ORIGIN,
  WORKER_VERSION_HEADER,
} from "@nusnus/github-data/routes";

import {
  type Timing,
  WorkerClient,
} from "../../packages/site/src/github-data/snapshot/worker-client.ts";
import { type FetchFailure, fetchFailureOf } from "../fetch-failure.ts";
import { WORKER_PROFILE_URL } from "../worker-profile.ts";

/**
 * What the wait runs on: the network, and the timing the site's worker client
 * keeps, but for its random source.
 */
export interface WaitDependencies extends Omit<Timing, "random"> {
  readonly fetch: typeof fetch;
}

/** What one request found: the version that answered, or how it failed. */
type Answer =
  | { readonly failure: FetchFailure; readonly reason: string }
  | { readonly version: null | string };

// Asking each second at first finds a version that serves within seconds, and
// asking no more often than every ten afterwards spares the worker. Only one
// deploy waits at a time, as deploy.yml's concurrency group runs them, so each
// wait is the backoff's whole ceiling, with no jitter to spread clients apart.
const FIRST_WAIT_MS = 1000;
const LONGEST_WAIT_MS = 10_000;
// The site's build, which comes next, gives each request to the worker this
// long, so a version that answers within it answers the build too.
const REQUEST_TIMEOUT_MS = WorkerClient.ATTEMPT_TIMEOUT_MS;
// Cloudflare documents no time by which a new version serves every request,
// so the wait allows the new version four whole requests, even if each runs
// to its timeout; a version that answers as fast as a healthy worker, within
// a second, gets many more.
const WAIT_LIMIT_MS = 4 * REQUEST_TIMEOUT_MS;

export async function awaitWorkerVersion(
  env: NodeJS.ProcessEnv,
  { fetch, now, timeout, wait }: WaitDependencies,
  report: (line: string) => void,
): Promise<0 | 1> {
  const versionId = env["WORKER_VERSION_ID"];
  if (versionId === undefined || versionId === "") {
    report(
      "Set WORKER_VERSION_ID to the id of the worker version to wait for, as the Deploy workflow does from Wrangler's report of its deploy.",
    );
    return 1;
  }
  const deadline = now().getTime() + WAIT_LIMIT_MS;
  for (let attempt = 1; ; attempt += 1) {
    const answer = await askVersion(fetch, timeout);
    if ("version" in answer && answer.version === versionId) {
      report(`The worker at ${WORKER_ORIGIN} serves version ${versionId}.`);
      return 0;
    }
    const waitMs = backoffCeilingMs(FIRST_WAIT_MS, attempt, LONGEST_WAIT_MS);
    if (now().getTime() + waitMs > deadline) {
      report(
        `The worker at ${WORKER_ORIGIN} does not serve version ${versionId} after ${String(WAIT_LIMIT_MS / 1000)} seconds of waiting: ` +
          `when last asked, it ${describe(answer)}. ` +
          "Rerun the newest Deploy run's failed jobs, or dispatch a new run, since an older run waits for a version a newer run has replaced; " +
          "if this fails again, check the worker's deployments in the Cloudflare dashboard's Workers & Pages.",
      );
      return 1;
    }
    await wait(waitMs);
  }
}

async function askVersion(
  fetchFromNetwork: typeof fetch,
  timeout: Timing["timeout"],
): Promise<Answer> {
  try {
    const response = await fetchFromNetwork(WORKER_PROFILE_URL, {
      signal: timeout(REQUEST_TIMEOUT_MS),
    });
    // Reading the body ends the request, which the version needs no more of.
    await response.text();
    return { version: response.headers.get(WORKER_VERSION_HEADER) };
  } catch (error) {
    return { failure: fetchFailureOf(error), reason: String(error) };
  }
}

function describe(answer: Answer): string {
  if ("failure" in answer) {
    return answer.failure === "timeout"
      ? `gave no answer within ${String(REQUEST_TIMEOUT_MS / 1000)} seconds`
      : `could not be reached: ${answer.reason}`;
  }
  return answer.version === null
    ? "named no version"
    : `served version ${answer.version}`;
}
