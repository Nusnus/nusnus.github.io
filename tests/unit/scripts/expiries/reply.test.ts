/**
 * @file A service's response reads into a reply only with status 200, and
 * only when its body is JSON that holds the reply's schema; each failure
 * quotes what the service sent and says what to do next.
 */

import * as schema from "@nusnus/github-data/schema";
import { describe, expect, it } from "vitest";

import { ExpiryCheckError } from "../../../../scripts/expiries/expiry.ts";
import { parseBody, parseReply } from "../../../../scripts/expiries/reply.ts";
import { receivedFrom, recorded } from "../../../fixtures/services/network.ts";

const VERSIONS_SCHEMA = schema.array(schema.iso.date());

describe("parseReply", () => {
  it("reads a reply's JSON body through its schema", () => {
    expect(
      parseReply(receivedFrom(recorded("github/versions")), VERSIONS_SCHEMA),
    ).toStrictEqual(["2026-03-10", "2022-11-28"]);
  });

  it("refuses a response with any other status, quoting it", () => {
    expect(() =>
      parseReply(
        // No service the check asks answers 201 on demand, so this serves a
        // recorded reply with it.
        receivedFrom({ ...recorded("github/versions"), status: 201 }),
        VERSIONS_SCHEMA,
      ),
    ).toThrow(
      new ExpiryCheckError(
        'GET https://api.github.com/versions answered 201: ["2026-03-10","2022-11-28"]\n' +
          "The next scheduled run repeats the check; if the failure lasts, fix the expiry check's request to it.",
      ),
    );
  });
});

describe("parseBody", () => {
  it("refuses a body that breaks the schema, quoting it", () => {
    expect(() =>
      parseBody(
        receivedFrom(recorded("github/versions")),
        schema.array(schema.int()),
      ),
    ).toThrow(
      new ExpiryCheckError(
        "The body GET https://api.github.com/versions answered with 200 is not in the shape the check reads:\n" +
          "✖ Invalid input: expected number, received string\n  → at [0]\n" +
          "✖ Invalid input: expected number, received string\n  → at [1]\n" +
          '["2026-03-10","2022-11-28"]\n' +
          "Update the expiry check's schema for it to what the service sends now.",
      ),
    );
  });

  it("refuses a body that is not JSON, quoting it", () => {
    expect(() =>
      parseBody(receivedFrom(recorded("node/missing-file")), VERSIONS_SCHEMA),
    ).toThrow(
      new ExpiryCheckError(
        "The body GET https://raw.githubusercontent.com/nodejs/Release/main/missing-file.json answered with 404 is not JSON:\n" +
          "404: Not Found\n" +
          "The next scheduled run repeats the check; if the failure lasts, fix the expiry check's request to it.",
      ),
    );
  });
});
