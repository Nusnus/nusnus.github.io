/**
 * @file A chart's gridline: a faint line in the border colour between its two
 * points, dashed unless it is the chart's baseline.
 */

import { describe, expect, it } from "vitest";

import { Gridline } from "../../../../../src/github-data/contributions/chart/Gridline.tsx";
import { findElement, render } from "../../../../fixtures/unit-page.ts";

function lineOf(gridline: React.JSX.Element): (null | string)[] {
  const line = findElement(render(<svg>{gridline}</svg>).container, "line");
  return [
    "stroke",
    "stroke-dasharray",
    "stroke-width",
    "opacity",
    "x1",
    "x2",
  ].map((name) => line.getAttribute(name));
}

describe("Gridline", () => {
  it("is a faint dashed line in the border colour, from the left edge", () => {
    expect(
      lineOf(<Gridline opacity={0.5} x2={40} y1={8} y2={8} />),
    ).toStrictEqual(["var(--color-border)", "3 3", "0.5", "0.5", "0", "40"]);
  });

  it("is solid as the baseline", () => {
    expect(
      lineOf(
        <Gridline dashed={false} opacity={0.6} x1={4} x2={40} y1={8} y2={8} />,
      ),
    ).toStrictEqual(["var(--color-border)", null, "0.5", "0.6", "4", "40"]);
  });
});
