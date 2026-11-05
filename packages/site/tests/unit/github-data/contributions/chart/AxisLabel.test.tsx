/**
 * @file A chart's axis label: muted text in the sans font by default, in the
 * mono font when it is a figure, and primary while its datum is hovered.
 */

import { describe, expect, it } from "vitest";

import { AxisLabel } from "../../../../../src/github-data/contributions/chart/AxisLabel.tsx";
import { findElement, render } from "../../../../fixtures/unit-page.ts";

function textOf(label: React.JSX.Element): (null | string)[] {
  const text = findElement(render(<svg>{label}</svg>).container, "text");
  return ["class", "font-family", "font-size", "text-anchor", "x", "y"].map(
    (name) => text.getAttribute(name),
  );
}

describe("AxisLabel", () => {
  it("is muted text in the sans font", () => {
    expect(
      textOf(
        <AxisLabel fontSize={9} y={10}>
          Mon
        </AxisLabel>,
      ),
    ).toStrictEqual([
      "fill-text-muted",
      "var(--font-sans)",
      "9",
      null,
      null,
      "10",
    ]);
  });

  it("is a figure in the mono font, anchored where asked", () => {
    expect(
      textOf(
        <AxisLabel font="mono" fontSize={8} textAnchor="end" x={26} y={155}>
          5
        </AxisLabel>,
      ),
    ).toStrictEqual([
      "fill-text-muted",
      "var(--font-mono)",
      "8",
      "end",
      "26",
      "155",
    ]);
  });

  it("is primary while its datum is hovered", () => {
    expect(
      textOf(
        <AxisLabel fontSize={8} hovered y={10}>
          Nov
        </AxisLabel>,
      )[0],
    ).toBe("fill-text-primary");
  });
});
