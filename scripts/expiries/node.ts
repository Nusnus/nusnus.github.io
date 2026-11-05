/**
 * @file The expiry the Node.js project sets: the end of support for the release
 * the check runs on, from the Node.js release schedule. mise runs the release
 * `mise.toml` pins, and Renovate proposes each newer one; this expiry warns
 * when no newer major has landed in time.
 */

import * as schema from "@nusnus/github-data/schema";

import { Expiry, ExpiryCheckError } from "./expiry.ts";
import { parseReply, type ReceivedResponse } from "./reply.ts";

// The Node.js release schedule: when each release line's support ends, keyed
// by its major version, such as `v26`:
// https://github.com/nodejs/Release#release-schedule
export const RELEASE_SCHEDULE_URL =
  "https://raw.githubusercontent.com/nodejs/Release/main/schedule.json";

export const releaseScheduleSchema = schema.record(
  schema.string(),
  schema.object({ end: schema.iso.date() }),
);

const NODE_RENEWAL =
  "Merge Renovate's update of node in mise.toml, or pin node there to the newest LTS release at https://nodejs.org/en/about/previous-releases, " +
  "then run `mise install` and `bun run check`, whose pinned-tools check names what else moves with Node.js's major.";

export function parseReleaseSchedule(
  response: ReceivedResponse,
): schema.Infer<typeof releaseScheduleSchema> {
  if (response.status === 404) {
    throw new ExpiryCheckError(
      `GET ${response.url} answered 404, so the Node.js release schedule has moved. ` +
        "Find it at https://github.com/nodejs/Release, and set RELEASE_SCHEDULE_URL to it.",
    );
  }
  return parseReply(response, releaseScheduleSchema);
}

export function nodeExpiry(
  nodeVersion: string,
  schedule: schema.Infer<typeof releaseScheduleSchema>,
): Expiry {
  const major = Number.parseInt(nodeVersion, 10);
  const release = schedule[`v${String(major)}`];
  if (release === undefined) {
    throw new ExpiryCheckError(
      `The Node.js release schedule has no release ${String(major)}, which runs the check, as ${nodeVersion}. ${NODE_RENEWAL}`,
    );
  }
  return new Expiry(
    `Node.js ${String(major)}'s support`,
    // A date without a time reads as that day's midnight in UTC:
    // https://tc39.es/ecma262/#sec-date-time-string-format
    new Date(release.end),
    NODE_RENEWAL,
  );
}
