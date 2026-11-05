/**
 * @file Redaction: a repository is allowlisted only when its owner is on the
 * list, in any letter case, and a redacted event links to its owner's page.
 */

import { describe, expect, it } from "vitest";

import { isAllowlisted, redactedUrl } from "../../src/redaction.ts";

describe("isAllowlisted", () => {
  it.each([
    "Nusnus/nustack",
    "nusnus/nusnus.github.io",
    "celery/celery",
    "CELERY/kombu",
    "mher/flower",
  ] as const)("holds %s", (fullName) => {
    expect(isAllowlisted(fullName)).toBe(true);
  });

  it.each(["AsymptotaX/agents", "AsymptotaX/celery"] as const)(
    "refuses %s, whose owner is not on the list",
    (fullName) => {
      expect(isAllowlisted(fullName)).toBe(false);
    },
  );
});

describe("redactedUrl", () => {
  it("is the page of the repository's owner", () => {
    expect(redactedUrl("AsymptotaX/agents")).toBe(
      "https://github.com/AsymptotaX",
    );
  });
});
