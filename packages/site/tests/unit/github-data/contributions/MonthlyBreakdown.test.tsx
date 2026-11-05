/**
 * @file The monthly breakdown: a bar per calendar month as tall as its share of
 * the busiest month, labelled with its month, and its year where the chart
 * shows the month twice; bars no narrower than 8; a month's total on hover or
 * tap; and, as an island, the page's graph.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import MonthlyBreakdownIsland, {
  MonthlyBreakdown,
} from "../../../../src/github-data/contributions/MonthlyBreakdown.tsx";
import { contributionGraph } from "../../../fixtures/contribution-graphs.ts";
import {
  findElement,
  fireEvent,
  render,
  screen,
} from "../../../fixtures/unit-page.ts";

// January has 3 contributions, February 7.
const TWO_MONTHS = contributionGraph(
  { day: 30, month: 1, year: 2026 },
  [1, 2, 3, 4],
);

function bars(container: HTMLElement): SVGRectElement[] {
  return [...container.querySelectorAll<SVGRectElement>("rect[rx]")];
}

function hitAreas(container: HTMLElement): SVGRectElement[] {
  return [
    ...container.querySelectorAll<SVGRectElement>('rect[fill="transparent"]'),
  ];
}

function hitArea(container: HTMLElement, index: number): Element {
  return findElement(container, 'rect[fill="transparent"]', { index });
}

function monthLabels(container: HTMLElement): (null | string)[] {
  return [...container.querySelectorAll('text[font-size="8"]')].map(
    (label) => label.textContent,
  );
}

describe("MonthlyBreakdown", () => {
  it("draws each month's bar as tall as its share of the busiest month, at its full width", () => {
    const { container } = render(<MonthlyBreakdown graph={TWO_MONTHS} />);

    expect([
      container.querySelector("svg")?.getAttribute("viewBox"),
      container.querySelector("svg")?.getAttribute("width"),
      bars(container).map((bar) =>
        ["x", "y", "width", "height", "opacity"].map((name) =>
          bar.getAttribute(name),
        ),
      ),
      monthLabels(container),
    ]).toStrictEqual([
      "0 0 600 164",
      "100%",
      [
        ["0", "92.57142857142858", "298", "51.42857142857142", "0.7"],
        ["302", "24", "298", "120", "0.7"],
      ],
      ["Jan", "Feb"],
    ]);
  });

  it("labels a month the chart shows twice with its year", () => {
    const { container } = render(
      <MonthlyBreakdown
        graph={contributionGraph(
          { day: 4, month: 11, year: 2025 },
          Array<number>(366).fill(1),
        )}
      />,
    );

    expect(monthLabels(container)).toStrictEqual([
      "Nov ’25",
      "Dec",
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov ’26",
    ]);
  });

  it("keeps each bar at least 8 wide, however many months it shows", () => {
    const { container } = render(
      <MonthlyBreakdown
        graph={contributionGraph(
          { day: 1, month: 1, year: 2021 },
          Array<number>(1827).fill(1),
        )}
      />,
    );

    expect([
      bars(container).length,
      bars(container)[0]?.getAttribute("width"),
      container.querySelector("svg")?.getAttribute("viewBox"),
    ]).toStrictEqual([61, "8", "0 0 728 164"]);
  });

  it("draws flat bars for a year without contributions", () => {
    const { container } = render(
      <MonthlyBreakdown
        graph={contributionGraph({ day: 31, month: 1, year: 2026 }, [0, 0])}
      />,
    );

    expect(
      bars(container).map((bar) => bar.getAttribute("height")),
    ).toStrictEqual(["0", "0"]);
  });

  it("marks a quarter, a half and three quarters of the busiest month", () => {
    const { container } = render(<MonthlyBreakdown graph={TWO_MONTHS} />);

    expect(
      [...container.querySelectorAll("line")].map((line) => [
        line.getAttribute("y1"),
        line.getAttribute("y2"),
      ]),
    ).toStrictEqual([
      ["114", "114"],
      ["84", "84"],
      ["54", "54"],
    ]);
  });

  it("labels each bar below its middle, and lets the pointer hover over its column, precisely", () => {
    const { container } = render(<MonthlyBreakdown graph={TWO_MONTHS} />);

    expect([
      [...container.querySelectorAll('text[font-size="8"]')].map((label) =>
        ["x", "y", "class"].map((name) => label.getAttribute(name)),
      ),
      hitAreas(container).map((area) => area.getAttribute("height")),
      renderToStaticMarkup(<MonthlyBreakdown graph={TWO_MONTHS} />).includes(
        'style="shape-rendering:geometricPrecision"',
      ),
    ]).toStrictEqual([
      [
        ["149", "158", "fill-text-muted"],
        ["451", "158", "fill-text-muted"],
      ],
      ["140", "140"],
      true,
    ]);
  });

  it("on hover, brings the month's bar forward, fades the rest and shows its total", () => {
    const { container } = render(<MonthlyBreakdown graph={TWO_MONTHS} />);

    fireEvent.mouseEnter(hitArea(container, 1));

    expect([
      bars(container).map((bar) => [
        bar.getAttribute("opacity"),
        bar.getAttribute("fill"),
      ]),
      ["x", "y"].map((name) =>
        container.querySelector('text[font-size="9"]')?.getAttribute(name),
      ),
      container.querySelector('text[font-size="9"]')?.textContent,
      container.querySelector('.fill-text-primary[font-size="8"]')?.textContent,
    ]).toStrictEqual([
      [
        ["0.35", "var(--color-accent)"],
        ["1", "var(--color-accent-hover)"],
      ],
      ["451", "18"],
      "7",
      "Feb",
    ]);
  });

  it("restores every bar once the pointer leaves", () => {
    const { container } = render(<MonthlyBreakdown graph={TWO_MONTHS} />);
    fireEvent.mouseEnter(hitArea(container, 0));

    fireEvent.mouseLeave(hitArea(container, 0));

    expect([
      bars(container).map((bar) => bar.getAttribute("opacity")),
      container.querySelector('text[font-size="9"]'),
    ]).toStrictEqual([["0.7", "0.7"], null]);
  });

  it("toggles a month's total on a tap, without the mouse events that follow", () => {
    const { container } = render(<MonthlyBreakdown graph={TWO_MONTHS} />);
    const followed = fireEvent.touchStart(hitArea(container, 0));
    const shown = container.querySelector('text[font-size="9"]')?.textContent;
    fireEvent.touchStart(hitArea(container, 0));

    expect([
      followed,
      shown,
      container.querySelector('text[font-size="9"]'),
    ]).toStrictEqual([false, "3", null]);
  });

  it("draws nothing for a graph without days", () => {
    const { container } = render(
      <MonthlyBreakdown
        graph={contributionGraph({ day: 4, month: 11, year: 2026 }, [])}
      />,
    );

    expect(container.innerHTML).toBe("");
  });

  it("draws the page's months as an island", () => {
    render(<MonthlyBreakdownIsland />);

    expect(screen.getByRole("img").querySelectorAll("rect[rx]")).toHaveLength(
      13,
    );
  });
});
