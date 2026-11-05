/**
 * @file Finding an element a component renders: the element at the id, of the
 * kind asked for, or a failure naming the component to render.
 */

import { describe, expect, it } from "vitest";

import { elementById } from "../../src/element-by-id.ts";

describe("elementById", () => {
  it("finds the element of the kind asked for at the id", () => {
    document.body.innerHTML = '<dialog id="drawer"></dialog>';

    expect(
      elementById(document, "drawer", HTMLDialogElement, "Drawer.astro")
        .tagName,
    ).toBe("DIALOG");
  });

  it.each([
    [
      "",
      'The page needs a HTMLDialogElement with id "drawer" but has none; render Drawer.astro on it.',
    ],
    [
      '<div id="drawer"></div>',
      'The page needs a HTMLDialogElement with id "drawer" but has a div; render Drawer.astro on it.',
    ],
  ])("refuses a page with %j at the id", (html, message) => {
    document.body.innerHTML = html;

    expect(() =>
      elementById(document, "drawer", HTMLDialogElement, "Drawer.astro"),
    ).toThrow(new TypeError(message));
  });
});
