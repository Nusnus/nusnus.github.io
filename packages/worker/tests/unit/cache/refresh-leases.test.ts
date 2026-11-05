/**
 * @file Refresh leases: one holder per key at a time, each lease lapsing on its
 * own after its length, and keys independent of each other.
 */

import { describe, expect, it } from "vitest";

import { RefreshLeases } from "../../../src/cache/refresh-leases.ts";

const TAKEN_AT = new Date("2026-11-04T00:00:00Z");

function after(milliseconds: number): Date {
  return new Date(TAKEN_AT.getTime() + milliseconds);
}

describe("RefreshLeases.tryAcquire", () => {
  it("takes a free lease", () => {
    expect(new RefreshLeases(1000).tryAcquire("a", TAKEN_AT)).toBe(true);
  });

  it("refuses a lease held until a later moment", () => {
    const leases = new RefreshLeases(1000);
    leases.tryAcquire("a", TAKEN_AT);

    expect(leases.tryAcquire("a", after(999))).toBe(false);
  });

  it("takes a lease again once it lapses", () => {
    const leases = new RefreshLeases(1000);
    leases.tryAcquire("a", TAKEN_AT);

    expect(leases.tryAcquire("a", after(1000))).toBe(true);
  });

  it("holds each key's lease apart", () => {
    const leases = new RefreshLeases(1000);
    leases.tryAcquire("a", TAKEN_AT);

    expect(leases.tryAcquire("b", TAKEN_AT)).toBe(true);
  });
});
