/**
 * @file A chart as one labelled image: a positioned wrapper, with any classes
 * the chart adds, holding the SVG drawing, which fills its width, scales the
 * given size to fit and may reach past its edges, and then the annotations.
 */

import { describe, expect, it } from "vitest";

import { ChartImage } from "../../../../../src/github-data/contributions/chart/ChartImage.tsx";
import { render, screen } from "../../../../fixtures/unit-page.ts";

describe("ChartImage", () => {
  it("is a positioned image, named by its label, of the drawing, then its annotations", () => {
    render(
      <ChartImage
        annotations={<p>Legend</p>}
        height={20}
        label="A chart"
        width={40}
      >
        <circle r={2} />
      </ChartImage>,
    );
    const image = screen.getByRole("img", { name: "A chart" });
    const [svg, annotations] = image.children;

    expect([
      image.className,
      svg?.getAttribute("class"),
      svg?.getAttribute("viewBox"),
      svg?.getAttribute("width"),
      svg?.innerHTML,
      annotations?.outerHTML,
    ]).toStrictEqual([
      "relative",
      "overflow-visible",
      "0 0 40 20",
      "100%",
      '<circle r="2"></circle>',
      "<p>Legend</p>",
    ]);
  });

  it("adds the classes the chart gives it to its wrapper", () => {
    render(
      <ChartImage className="@container" height={20} label="A chart" width={40}>
        <circle r={2} />
      </ChartImage>,
    );

    expect(screen.getByRole("img").className).toBe("relative @container");
  });
});
