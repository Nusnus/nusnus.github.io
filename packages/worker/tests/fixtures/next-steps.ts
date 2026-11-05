/**
 * @file The next steps that end the worker's error messages, each written once
 * for every test that expects a whole message ending with it: GitHub down or
 * slow, the fetch's deadline spent, a reply in a shape the worker does not
 * read, a token or request GitHub refuses, a tracked repository GitHub does
 * not have, a backoff stored in another shape, and a fault in the worker.
 */

export const TRANSIENT_STEP =
  "https://www.githubstatus.com shows whether GitHub is down; the worker asks again later.";

export const DEADLINE_SPENT_STEP =
  "Fetch the route's data in fewer requests; the worker asks again later.";

export const MISSHAPEN_STEP =
  "Update the worker's schema of it to what GitHub documents under API version 2026-03-10.";

export const REFUSED_TOKEN_STEP =
  "Store a valid token in the worker's GITHUB_TOKEN secret.";

export const REFUSED_REQUEST_STEP =
  "Fix the request, or the token's access, as GitHub's message says.";

export const REPOSITORY_NOT_FOUND_STEP = "Remove it from TRACKED_REPOSITORIES.";

export const BACKOFF_SHAPE_STEP =
  "Fix how the worker builds, stores or reads backoffs.";

export const FAULT_STEP =
  "Fix the fault in the worker; its logs say where it arose.";
