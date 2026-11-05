/**
 * @file A caption: its text in small, muted, spaced capitals, spaced from what
 * follows as the caller says.
 */

import { describe, expect, it } from "vitest";

import { Caption } from "../../../src/design-system/Caption.tsx";
import { findElement, render } from "../../fixtures/unit-page.ts";

describe("Caption", () => {
  it("shows its text as a muted, spaced, capitalised paragraph with the caller's spacing", () => {
    const { container } = render(<Caption className="mb-2">Rankings</Caption>);
    const caption = findElement(container, "p");

    expect([caption.textContent, [...caption.classList]]).toStrictEqual([
      "Rankings",
      expect.arrayContaining([
        "text-xs",
        "font-medium",
        "tracking-wider",
        "text-text-muted",
        "uppercase",
        "mb-2",
      ]),
    ]);
  });
});
