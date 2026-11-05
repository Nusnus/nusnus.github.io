/**
 * @file What the check learned from a source becomes an outcome: its
 * expiries, or the failure to learn them that the check expects, while any
 * other error escapes. The report prints a line for each expiry and each
 * failure, each due expiry and each failure as a GitHub Actions error whose
 * line breaks are escaped, and exits with 1 when any is, else 0.
 */

import { describe, expect, it } from "vitest";

import {
  Expiry,
  ExpiryCheckError,
} from "../../../../scripts/expiries/expiry.ts";
import {
  asExpiryCheckError,
  outcomeOf,
  reportOutcomes,
} from "../../../../scripts/expiries/report.ts";

const NOW = new Date("2026-11-04T00:00:00Z");
const LASTING = new Expiry("The token", "never", "Renew it.");
const DUE = new Expiry("The key", new Date("2026-11-05T00:00:00Z"), "Roll it.");
const FAILURE = new ExpiryCheckError("The service failed.");

describe("outcomeOf", () => {
  it("is the expiries a source's value holds", () => {
    expect(
      outcomeOf({ status: "fulfilled", value: LASTING }, (expiry) => [expiry]),
    ).toStrictEqual([LASTING]);
  });

  it("is the expected failure that rejected the source", () => {
    expect(
      outcomeOf({ reason: FAILURE, status: "rejected" }, () => [LASTING]),
    ).toBe(FAILURE);
  });

  it("is the expected failure to read the expiries from the source's value", () => {
    expect(
      outcomeOf({ status: "fulfilled", value: LASTING }, () => {
        throw FAILURE;
      }),
    ).toBe(FAILURE);
  });
});

describe("asExpiryCheckError", () => {
  it("is a failure to learn an expiry", () => {
    expect(asExpiryCheckError(FAILURE)).toBe(FAILURE);
  });

  it("lets any other error escape", () => {
    const bug = new TypeError("a bug");

    expect(() => asExpiryCheckError(bug)).toThrow(new TypeError("a bug"));
  });
});

describe("reportOutcomes", () => {
  it("passes while nothing is due, a line for each expiry", () => {
    expect(
      reportOutcomes(
        [[LASTING], [new Expiry("100% of the quota", "never", "Raise it.")]],
        NOW,
      ),
    ).toStrictEqual({
      exitCode: 0,
      lines: ["The token never expires.", "100% of the quota never expires."],
    });
  });

  it("fails on an expiry that is due, as an error that says how to renew it", () => {
    expect(reportOutcomes([[LASTING, DUE]], NOW)).toStrictEqual({
      exitCode: 1,
      lines: [
        "The token never expires.",
        "::error::The key expires on 2026-11-05, in 1 day. Roll it.",
      ],
    });
  });

  it("fails on a failure to learn an expiry, as an error with its line breaks escaped", () => {
    expect(
      reportOutcomes(
        [new ExpiryCheckError("Line one,\r\nline two at 100%."), [LASTING]],
        NOW,
      ),
    ).toStrictEqual({
      exitCode: 1,
      lines: [
        "::error::Line one,%0D%0Aline two at 100%25.",
        "The token never expires.",
      ],
    });
  });
});
