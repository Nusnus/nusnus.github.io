/**
 * @file The Node.js release schedule is read through its schema, and fails,
 * saying where to look, once it has moved. The expiry of the release the check
 * runs on is the end of its support in the schedule; a release the schedule
 * lacks fails, saying how to move on.
 */

import { describe, expect, it } from "vitest";

import { ExpiryCheckError } from "../../../../scripts/expiries/expiry.ts";
import {
  nodeExpiry,
  parseReleaseSchedule,
} from "../../../../scripts/expiries/node.ts";
import {
  receivedFrom,
  recorded,
  servedAt,
} from "../../../fixtures/services/network.ts";

const RENEWAL =
  "Merge Renovate's update of node in mise.toml, or pin node there to the newest LTS release at https://nodejs.org/en/about/previous-releases, " +
  "then run `mise install` and `bun run check`, whose pinned-tools check names what else moves with Node.js's major.";
const SCHEDULE = parseReleaseSchedule(receivedFrom(recorded("node/schedule")));

describe("parseReleaseSchedule", () => {
  it("reads when each release's support ends", () => {
    expect(SCHEDULE["v26"]).toStrictEqual({ end: "2029-04-30" });
  });

  it("refuses a schedule that has moved, saying where to find it", () => {
    expect(() =>
      parseReleaseSchedule(
        receivedFrom(
          servedAt(
            recorded("node/missing-file"),
            "https://raw.githubusercontent.com/nodejs/Release/main/schedule.json",
          ),
        ),
      ),
    ).toThrow(
      new ExpiryCheckError(
        "GET https://raw.githubusercontent.com/nodejs/Release/main/schedule.json answered 404, so the Node.js release schedule has moved. " +
          "Find it at https://github.com/nodejs/Release, and set RELEASE_SCHEDULE_URL to it.",
      ),
    );
  });
});

describe("nodeExpiry", () => {
  it("expires when the support for the release ends, saying how to move to a maintained one", () => {
    const expiry = nodeExpiry("26.13.0", SCHEDULE);

    expect([expiry.subject, expiry.expiresAt, expiry.renewal]).toStrictEqual([
      "Node.js 26's support",
      new Date("2029-04-30T00:00:00Z"),
      RENEWAL,
    ]);
  });

  it("refuses a release the schedule lacks, saying how to move on", () => {
    expect(() => nodeExpiry("99.0.0", SCHEDULE)).toThrow(
      new ExpiryCheckError(
        "The Node.js release schedule has no release 99, which runs the check, as 99.0.0. " +
          "Merge Renovate's update of node in mise.toml, or pin node there to the newest LTS release at https://nodejs.org/en/about/previous-releases, " +
          "then run `mise install` and `bun run check`, whose pinned-tools check names what else moves with Node.js's major.",
      ),
    );
  });
});
