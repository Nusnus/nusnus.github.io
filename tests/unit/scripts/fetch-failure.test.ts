/**
 * @file A fetch's rejection reads as how the request failed: a TypeError as
 * the network failing, and a TimeoutError as the deadline passing. Any other
 * error, another DOMException included, escapes.
 */

import { describe, expect, it } from "vitest";

import { fetchFailureOf } from "../../../scripts/fetch-failure.ts";

describe("fetchFailureOf", () => {
  it("reads a TypeError as the network failing", () => {
    expect(fetchFailureOf(new TypeError("fetch failed"))).toBe("network");
  });

  it("reads the deadline's TimeoutError as the deadline passing", () => {
    expect(
      fetchFailureOf(
        new DOMException(
          "The operation was aborted due to timeout",
          "TimeoutError",
        ),
      ),
    ).toBe("timeout");
  });

  it("lets another DOMException, such as an abort, escape", () => {
    expect(() =>
      fetchFailureOf(
        new DOMException("This operation was aborted", "AbortError"),
      ),
    ).toThrow(new DOMException("This operation was aborted", "AbortError"));
  });

  it("lets any other error escape", () => {
    expect(() => fetchFailureOf(new RangeError("a bug"))).toThrow(
      new RangeError("a bug"),
    );
  });
});
