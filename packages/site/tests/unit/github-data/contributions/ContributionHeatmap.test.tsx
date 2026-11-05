/**
 * @file The contribution heatmap: a cell per day in its week's column and its
 * weekday's row, shaded by level; month labels where a week starts a month,
 * weekday labels and a legend; a tooltip with the day's count and date on
 * hover, and toggled by a tap; and, as an island, the page's graph.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ContributionHeatmapIsland, {
  ContributionHeatmap,
} from "../../../../src/github-data/contributions/ContributionHeatmap.tsx";
import { contributionGraph } from "../../../fixtures/contribution-graphs.ts";
import {
  findElement,
  fireEvent,
  render,
  screen,
} from "../../../fixtures/unit-page.ts";

// The week from Sunday, March 22, 2026, then the next, which starts April.
const GRAPH = contributionGraph(
  { day: 22, month: 3, year: 2026 },
  [0, 1, 3, 4, 6, 7, 10, 11, 2, 0, 0, 0, 0, 0, 1],
);

function cells(container: HTMLElement): SVGRectElement[] {
  return [...container.querySelectorAll("rect")];
}

function cell(container: HTMLElement, index: number): Element {
  return findElement(container, "rect", { index });
}

function tooltip(): HTMLElement | null {
  return document.querySelector(".pointer-events-none");
}

describe("ContributionHeatmap", () => {
  it("names the year's total for screen readers", () => {
    render(<ContributionHeatmap graph={GRAPH} />);

    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(
      "GitHub contribution graph showing 45 contributions in the last year",
    );
  });

  it("places each day in its week's column and weekday's row, shaded by level", () => {
    const { container } = render(<ContributionHeatmap graph={GRAPH} />);

    expect(
      cells(container)
        .slice(0, 9)
        .map((cell) => [
          cell.getAttribute("x"),
          cell.getAttribute("y"),
          cell.getAttribute("class"),
        ]),
    ).toStrictEqual([
      ["28", "16", "fill-current text-bg-elevated"],
      ["28", "29", "fill-current text-contribution-1"],
      ["28", "42", "fill-current text-contribution-1"],
      ["28", "55", "fill-current text-contribution-2"],
      ["28", "68", "fill-current text-contribution-2"],
      ["28", "81", "fill-current text-contribution-3"],
      ["28", "94", "fill-current text-contribution-3"],
      ["41", "16", "fill-current text-accent"],
      ["41", "29", "fill-current text-contribution-1"],
    ]);
  });

  it("draws 10px cells with 3px gaps, which the SVG scales to its full width", () => {
    const { container } = render(<ContributionHeatmap graph={GRAPH} />);

    expect([
      findElement(container, "svg").getAttribute("viewBox"),
      findElement(container, "svg").getAttribute("width"),
      cell(container, 0).getAttribute("width"),
      cell(container, 0).getAttribute("height"),
      cell(container, 0).getAttribute("rx"),
    ]).toStrictEqual(["0 0 67 107", "100%", "10", "10", "2.5"]);
  });

  it("labels each week that starts a new month, and every other weekday", () => {
    const { container } = render(<ContributionHeatmap graph={GRAPH} />);

    expect(
      [...container.querySelectorAll("text")].map((label) => [
        label.textContent,
        label.getAttribute("x"),
        label.getAttribute("y"),
      ]),
    ).toStrictEqual([
      ["Mar", "28", "10"],
      ["Apr", "54", "10"],
      ["Mon", null, "38"],
      ["Wed", null, "64"],
      ["Fri", null, "90"],
    ]);
  });

  it("leaves a week without days blank, and labels the next month's first week", () => {
    const [first, second, third] = GRAPH.weeks;
    const { container } = render(
      <ContributionHeatmap
        graph={{
          ...GRAPH,
          weeks: [first ?? [], [], second ?? [], third ?? []],
        }}
      />,
    );

    expect(
      [...container.querySelectorAll('text[y="10"]')].map((label) => [
        label.textContent,
        label.getAttribute("x"),
      ]),
    ).toStrictEqual([
      ["Mar", "28"],
      ["Apr", "67"],
    ]);
  });

  it("renders its shapes precisely", () => {
    expect(
      renderToStaticMarkup(<ContributionHeatmap graph={GRAPH} />),
    ).toContain('style="shape-rendering:geometricPrecision"');
  });

  it("shows the legend's levels from less to more, each a swatch shaped as a cell", () => {
    const CELL_STYLE = "border-radius: 2.5px; height: 10px; width: 10px;";
    const { container } = render(<ContributionHeatmap graph={GRAPH} />);

    expect(
      [...container.querySelectorAll<HTMLElement>(".bg-current")].map(
        (swatch) => [[...swatch.classList].at(-1), swatch.style.cssText],
      ),
    ).toStrictEqual([
      ["text-bg-elevated", CELL_STYLE],
      ["text-contribution-1", CELL_STYLE],
      ["text-contribution-2", CELL_STYLE],
      ["text-contribution-3", CELL_STYLE],
      ["text-accent", CELL_STYLE],
    ]);
  });

  it("draws each legend swatch the size and shape of a day", () => {
    const { container } = render(<ContributionHeatmap graph={GRAPH} />);

    expect(
      [...container.querySelectorAll<HTMLElement>(".bg-current")].map(
        ({ style }) => [style.width, style.height, style.borderRadius],
      ),
    ).toStrictEqual(Array(5).fill(["10px", "10px", "2.5px"]));
  });

  it("on hover, outlines the day alone, fades every other, and shows its count and date above it", () => {
    const { container } = render(<ContributionHeatmap graph={GRAPH} />);
    fireEvent.mouseEnter(cell(container, 3));

    expect([
      cell(container, 3).getAttribute("stroke"),
      cell(container, 3).getAttribute("opacity"),
      cell(container, 4).getAttribute("opacity"),
      cell(container, 10).getAttribute("opacity"),
      tooltip()?.textContent,
      tooltip()?.style.left,
      tooltip()?.style.top,
    ]).toStrictEqual([
      "var(--color-text-secondary)",
      null,
      "0.6",
      "0.6",
      "4 contributionsMarch 25, 2026",
      "41.7910447761194%",
      "calc(82.08955223880598cqw - 8px)",
    ]);
  });

  it.each([
    [0, "starts at", [], "41.7910447761194%"],
    [7, "centres on", ["-translate-x-1/2"], "68.65671641791045%"],
    [14, "ends at", ["-translate-x-full"], "95.52238805970148%"],
  ])(
    "lines the tooltip of the cell at %i up so it %s the cell, staying inside",
    (index, _, translates, left) => {
      const { container } = render(<ContributionHeatmap graph={GRAPH} />);

      fireEvent.mouseEnter(cell(container, index));

      expect([
        [...(tooltip()?.classList ?? [])].filter((name) =>
          name.startsWith("-translate-x"),
        ),
        tooltip()?.style.left,
      ]).toStrictEqual([translates, left]);
    },
  );

  it("counts a single contribution in the singular", () => {
    const { container } = render(<ContributionHeatmap graph={GRAPH} />);

    fireEvent.mouseEnter(cell(container, 1));

    expect(tooltip()?.textContent).toBe("1 contributionMarch 23, 2026");
  });

  it("hides the tooltip and fades nothing once the pointer leaves", () => {
    const { container } = render(<ContributionHeatmap graph={GRAPH} />);
    fireEvent.mouseEnter(cell(container, 0));

    fireEvent.mouseLeave(cell(container, 0));

    expect([
      tooltip(),
      cell(container, 0).getAttribute("stroke"),
      cell(container, 1).getAttribute("opacity"),
    ]).toStrictEqual([null, null, null]);
  });

  it("toggles a day's tooltip on a tap, without the mouse events that follow", () => {
    const { container } = render(<ContributionHeatmap graph={GRAPH} />);
    const followed = fireEvent.touchStart(cell(container, 0));
    const shown = tooltip()?.textContent;
    fireEvent.touchStart(cell(container, 1));
    const moved = tooltip()?.textContent;
    fireEvent.touchStart(cell(container, 1));

    expect([followed, shown, moved, tooltip()]).toStrictEqual([
      false,
      "0 contributionsMarch 22, 2026",
      "1 contributionMarch 23, 2026",
      null,
    ]);
  });

  it("draws the page's graph as an island", () => {
    render(<ContributionHeatmapIsland />);

    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(
      "GitHub contribution graph showing 5465 contributions in the last year",
    );
  });
});
