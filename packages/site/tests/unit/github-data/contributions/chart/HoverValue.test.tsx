/**
 * @file The value of a chart's hovered datum: bold figures in the mono font,
 * in the primary colour, centred where it is placed.
 */

import { describe, expect, it } from "vitest";

import { HoverValue } from "../../../../../src/github-data/contributions/chart/HoverValue.tsx";
import { findElement, render } from "../../../../fixtures/unit-page.ts";

describe("HoverValue", () => {
  it("shows the value in bold mono figures, in the primary colour, centred where it is placed", () => {
    const text = findElement(
      render(
        <svg>
          <HoverValue fontSize={10} fontWeight={700} value={42} x={30} y={8} />
        </svg>,
      ).container,
      "text",
    );

    expect([
      text.textContent,
      ...[
        "class",
        "font-family",
        "font-size",
        "font-weight",
        "text-anchor",
        "x",
        "y",
      ].map((name) => text.getAttribute(name)),
    ]).toStrictEqual([
      "42",
      "fill-text-primary",
      "var(--font-mono)",
      "10",
      "700",
      "middle",
      "30",
      "8",
    ]);
  });
});
