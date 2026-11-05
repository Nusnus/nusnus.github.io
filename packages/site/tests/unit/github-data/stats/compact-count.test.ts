/**
 * @file Compact counts: thousands and millions shortened, small counts in full.
 */

import { describe, expect, it } from "vitest";

import { compactCount } from "../../../../src/github-data/stats/compact-count.ts";

describe("compactCount", () => {
  it.each([
    [120, "120"],
    [5259, "5.3K"],
    [29_133, "29K"],
    [1_520_000, "1.5M"],
  ])("shows %i as %s", (count, shown) => {
    expect(compactCount(count)).toBe(shown);
  });
});
