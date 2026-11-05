/**
 * @file The unit tests' page: `findElement` finds the match a test asks for, of
 * the kind it asks for, or fails naming what it looked for; and happy-dom's
 * controls reach the page's window.
 */

import { describe, expect, it } from "vitest";

import { findElement, happyDOM } from "../../fixtures/unit-page.ts";

describe("findElement", () => {
  it("finds the first match, or the one at an index, of the kind asked for", () => {
    document.body.innerHTML = "<p>first</p><p>second</p>";

    expect([
      findElement(document, "p").textContent,
      findElement(document, "p", { index: 1, type: HTMLParagraphElement })
        .textContent,
    ]).toStrictEqual(["first", "second"]);
  });

  it.each([
    ["p", {}, "The test page has no element at p, match 0."],
    [
      "dialog",
      { index: 1 },
      "The test page has no element at dialog, match 1.",
    ],
    [
      "dialog",
      { type: HTMLButtonElement },
      "The test page has no HTMLButtonElement at dialog, match 0.",
    ],
  ])(
    "refuses a page without the match for %s that %o asks for",
    (selector, options, message) => {
      document.body.innerHTML = "<dialog></dialog>";

      expect(() => findElement(document, selector, options)).toThrow(
        new TypeError(message),
      );
    },
  );
});

describe("happyDOM", () => {
  it("controls the page's window", () => {
    happyDOM.setViewport({ height: 600, width: 500 });

    expect([window.innerWidth, window.innerHeight]).toStrictEqual([500, 600]);
  });
});
