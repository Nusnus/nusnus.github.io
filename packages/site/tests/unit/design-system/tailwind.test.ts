/**
 * @file `tw` returns the classes it marks as written, with any interpolated
 * classes in place.
 */

import { describe, expect, it } from "vitest";

import { tw } from "../../../src/design-system/tailwind.ts";

describe("tw", () => {
  it("returns the classes as written", () => {
    expect(tw`flex items-center`).toBe("flex items-center");
  });

  it("keeps interpolated classes in place", () => {
    const base = "flex";

    expect(tw`${base} items-center gap-1`).toBe("flex items-center gap-1");
  });
});
