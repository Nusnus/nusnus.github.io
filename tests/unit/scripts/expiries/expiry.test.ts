/**
 * @file The error that says why an expiry could not be learned names itself. An
 * expiry says when it expires, counting the days left, and is due from its
 * notice period before it expires; one that never expires is never due.
 */

import { describe, expect, it } from "vitest";

import {
  Expiry,
  ExpiryCheckError,
} from "../../../../scripts/expiries/expiry.ts";

const NOW = new Date("2026-11-04T12:00:00Z");

function expiringAt(instant: string): Expiry {
  return new Expiry("The token", new Date(instant), "Renew it.");
}

describe("ExpiryCheckError", () => {
  it("names itself where it prints", () => {
    expect(String(new ExpiryCheckError("probe"))).toBe(
      "ExpiryCheckError: probe",
    );
  });
});

describe("Expiry.describeAt", () => {
  it.each([
    ["2026-12-04T12:00:00Z", "The token expires on 2026-12-04, in 30 days."],
    ["2026-11-06T11:59:59Z", "The token expires on 2026-11-06, in 1 day."],
    ["2026-11-04T12:00:00Z", "The token expires on 2026-11-04, in 0 days."],
    ["2026-11-04T11:59:59Z", "The token expired on 2026-11-04."],
  ])("says an expiry at %s %j", (instant, description) => {
    expect(expiringAt(instant).describeAt(NOW)).toBe(description);
  });

  it("says when something never expires", () => {
    expect(new Expiry("The token", "never", "Renew it.").describeAt(NOW)).toBe(
      "The token never expires.",
    );
  });
});

describe("Expiry.isDueAt", () => {
  it.each(["2026-12-04T12:00:00Z", "2026-11-01T00:00:00Z"])(
    "counts an expiry at %s, within its notice period or past, as due",
    (instant) => {
      expect(expiringAt(instant).isDueAt(NOW)).toBe(true);
    },
  );

  it("counts an expiry further away than its notice period as not due", () => {
    expect(expiringAt("2026-12-04T12:00:00.001Z").isDueAt(NOW)).toBe(false);
  });

  it("never counts something that never expires as due", () => {
    expect(new Expiry("The token", "never", "Renew it.").isDueAt(NOW)).toBe(
      false,
    );
  });
});
