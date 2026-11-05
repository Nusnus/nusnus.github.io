/**
 * @file The Cloudflare token's expiry comes from Cloudflare's verification of
 * it. A verification is read through its schema; a token Cloudflare refuses
 * fails, quoting each reason Cloudflare gives and saying how to renew it, and
 * any other failure of Cloudflare's is no refusal. An active token expires
 * when Cloudflare says, or never; an inactive one fails, saying how to renew
 * it.
 */

import type { Exchange } from "@nusnus/github-data/fixtures/exchange";

import { describe, expect, it } from "vitest";

import {
  cloudflareTokenExpiry,
  parseTokenVerification,
} from "../../../../scripts/expiries/cloudflare.ts";
import { ExpiryCheckError } from "../../../../scripts/expiries/expiry.ts";
import { receivedFrom, recorded } from "../../../fixtures/services/network.ts";

const REFERENCE_EXAMPLE = recorded("cloudflare/verify-token-reference-example");

describe("parseTokenVerification", () => {
  it("reads Cloudflare's verification of a token", () => {
    expect(
      parseTokenVerification(receivedFrom(REFERENCE_EXAMPLE)),
    ).toStrictEqual({
      result: {
        expires_on: new Date("2020-01-01T00:00:00Z"),
        status: "active",
      },
    });
  });

  it.each([
    [
      "cloudflare/verify-unknown-token",
      'Cloudflare refused CLOUDFLARE_API_TOKEN with 401: Invalid API Token. Create a token from the "Edit Cloudflare Workers" template at https://dash.cloudflare.com/profile/api-tokens, or roll the current one there, then store it with `gh secret set CLOUDFLARE_API_TOKEN --env cloudflare`.',
    ],
    [
      "cloudflare/verify-malformed-token",
      'Cloudflare refused CLOUDFLARE_API_TOKEN with 400: Invalid request headers. Create a token from the "Edit Cloudflare Workers" template at https://dash.cloudflare.com/profile/api-tokens, or roll the current one there, then store it with `gh secret set CLOUDFLARE_API_TOKEN --env cloudflare`.',
    ],
  ])(
    "refuses the token Cloudflare refuses in %s, saying how to renew it",
    (name, refusal) => {
      expect(() =>
        parseTokenVerification(receivedFrom(recorded(name))),
      ).toThrow(new ExpiryCheckError(refusal));
    },
  );

  it("quotes each reason Cloudflare gives for refusing a token", () => {
    // No refusal with two reasons can be recorded on demand, so this one adds
    // a second reason to a recorded refusal.
    const refusal = recorded("cloudflare/verify-unknown-token");
    const twoReasons: Exchange = {
      ...refusal,
      body: {
        errors: [
          { code: 1000, message: "Invalid API Token" },
          { code: 1001, message: "Token disabled" },
        ],
        messages: [],
        result: null,
        success: false,
      },
    };

    expect(() => parseTokenVerification(receivedFrom(twoReasons))).toThrow(
      new ExpiryCheckError(
        'Cloudflare refused CLOUDFLARE_API_TOKEN with 401: Invalid API Token; Token disabled. Create a token from the "Edit Cloudflare Workers" template at https://dash.cloudflare.com/profile/api-tokens, or roll the current one there, then store it with `gh secret set CLOUDFLARE_API_TOKEN --env cloudflare`.',
      ),
    );
  });

  it("reads a failure of Cloudflare's own as no refusal of the token", () => {
    // Cloudflare cannot be made to fail on demand, so this serves the
    // reference example with a server error's status.
    expect(() =>
      parseTokenVerification(
        receivedFrom({ ...REFERENCE_EXAMPLE, status: 500 }),
      ),
    ).toThrow(
      new ExpiryCheckError(
        "GET https://api.cloudflare.com/client/v4/user/tokens/verify answered 500: " +
          '{"errors":[],"messages":[],"success":true,"result":{"id":"ed17574386854bf78a67040be0a770b0",' +
          '"status":"active","expires_on":"2020-01-01T00:00:00Z","not_before":"2018-07-01T05:20:00Z"}}\n' +
          "The next scheduled run repeats the check; if the failure lasts, fix the expiry check's request to it.",
      ),
    );
  });
});

describe("cloudflareTokenExpiry", () => {
  it("expires when Cloudflare says the token expires, saying how to renew it", () => {
    const expiry = cloudflareTokenExpiry(
      parseTokenVerification(receivedFrom(REFERENCE_EXAMPLE)),
    );

    expect([expiry.subject, expiry.expiresAt, expiry.renewal]).toStrictEqual([
      "The Cloudflare API token that deploys the worker",
      new Date("2020-01-01T00:00:00Z"),
      'Create a token from the "Edit Cloudflare Workers" template at https://dash.cloudflare.com/profile/api-tokens, ' +
        "or roll the current one there, then store it with `gh secret set CLOUDFLARE_API_TOKEN --env cloudflare`.",
    ]);
  });

  it("never expires when Cloudflare names no expiry", () => {
    // Cloudflare's reference shows only a token with an expiry, and verifying
    // the project's own token needs its secret, so this verification is
    // written as Cloudflare documents one without `expires_on`.
    expect(
      cloudflareTokenExpiry({ result: { status: "active" } }).expiresAt,
    ).toBe("never");
  });

  it.each([
    [
      "disabled",
      'Cloudflare reports CLOUDFLARE_API_TOKEN as disabled. Create a token from the "Edit Cloudflare Workers" template at https://dash.cloudflare.com/profile/api-tokens, or roll the current one there, then store it with `gh secret set CLOUDFLARE_API_TOKEN --env cloudflare`.',
    ],
    [
      "expired",
      'Cloudflare reports CLOUDFLARE_API_TOKEN as expired. Create a token from the "Edit Cloudflare Workers" template at https://dash.cloudflare.com/profile/api-tokens, or roll the current one there, then store it with `gh secret set CLOUDFLARE_API_TOKEN --env cloudflare`.',
    ],
  ])(
    "refuses a token Cloudflare holds %s, saying how to renew it",
    (status, refusal) => {
      // No inactive token can be recorded without the project's account, so
      // this serves the reference example with another status.
      const inactive: Exchange = {
        ...REFERENCE_EXAMPLE,
        body: {
          errors: [],
          messages: [],
          result: { expires_on: "2020-01-01T00:00:00Z", status },
          success: true,
        },
      };

      expect(() =>
        cloudflareTokenExpiry(parseTokenVerification(receivedFrom(inactive))),
      ).toThrow(new ExpiryCheckError(refusal));
    },
  );
});
