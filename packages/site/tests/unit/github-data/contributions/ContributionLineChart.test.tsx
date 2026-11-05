/**
 * @file The daily contributions line chart: the graph's last 30 days as a line
 * over a shaded area, a count axis whose ticks suit the busiest day, a gridline
 * a week, a lone day centred, a day's count on hover or tap, and, as an island,
 * the page's graph.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ContributionLineChartIsland, {
  ContributionLineChart,
} from "../../../../src/github-data/contributions/ContributionLineChart.tsx";
import { contributionGraph } from "../../../fixtures/contribution-graphs.ts";
import {
  findElement,
  fireEvent,
  render,
  screen,
} from "../../../fixtures/unit-page.ts";

const THREE_DAYS = contributionGraph(
  { day: 2, month: 11, year: 2026 },
  [0, 4, 2],
);

function attributes(
  elements: Iterable<Element>,
  ...names: string[]
): (null | string)[][] {
  return [...elements].map((element) =>
    names.map((name) => element.getAttribute(name)),
  );
}

describe("ContributionLineChart", () => {
  it("draws the line and the area under it through each day", () => {
    const { container } = render(<ContributionLineChart graph={THREE_DAYS} />);

    expect(attributes(container.querySelectorAll("path"), "d")).toStrictEqual([
      ["M32,152 L362,40 L692,96 L692,152 L32,152 Z"],
      ["M32,152 L362,40 L692,96"],
    ]);
  });

  it("lays its axes out around the plot, precisely, at its full width", () => {
    const { container } = render(<ContributionLineChart graph={THREE_DAYS} />);

    expect([
      container.querySelector("svg")?.getAttribute("viewBox"),
      container.querySelector("svg")?.getAttribute("width"),
      attributes(container.querySelectorAll("g > line"), "x1", "x2").at(0),
      attributes(
        container.querySelectorAll('text[text-anchor="end"]'),
        "x",
        "y",
      ).at(0),
      attributes(container.querySelectorAll("rect"), "height", "y").at(0),
      attributes(
        container.querySelectorAll('text[text-anchor="middle"]'),
        "y",
        "class",
      ).at(0),
      renderToStaticMarkup(
        <ContributionLineChart graph={THREE_DAYS} />,
      ).includes('style="shape-rendering:geometricPrecision"'),
    ]).toStrictEqual([
      "0 0 700 176",
      "100%",
      ["32", "692"],
      ["26", "155"],
      ["164", "12"],
      ["166", "fill-text-muted"],
      true,
    ]);
  });

  it("marks each day with a dot and its day of the month", () => {
    const { container } = render(<ContributionLineChart graph={THREE_DAYS} />);

    expect([
      attributes(container.querySelectorAll("circle"), "cx", "cy", "r"),
      [...container.querySelectorAll('text[text-anchor="middle"]')].map(
        (label) => label.textContent,
      ),
    ]).toStrictEqual([
      [
        ["32", "152", "3"],
        ["362", "40", "3"],
        ["692", "96", "3"],
      ],
      ["2", "3", "4"],
    ]);
  });

  it("shows only the last 30 days", () => {
    const { container } = render(
      <ContributionLineChart
        graph={contributionGraph(
          { day: 1, month: 10, year: 2026 },
          Array<number>(35).fill(1),
        )}
      />,
    );

    const labels = [
      ...container.querySelectorAll('text[text-anchor="middle"]'),
    ].map((label) => label.textContent);
    expect([labels.length, labels[0], labels.at(-1)]).toStrictEqual([
      30,
      "6",
      "4",
    ]);
  });

  it("centres a lone day, which spans no width", () => {
    const { container } = render(
      <ContributionLineChart
        graph={contributionGraph({ day: 4, month: 11, year: 2026 }, [3])}
      />,
    );

    expect([
      container.querySelector("circle")?.getAttribute("cx"),
      container.querySelector("rect")?.getAttribute("width"),
      container.querySelector("rect")?.getAttribute("x"),
    ]).toStrictEqual(["362", "660", "32"]);
  });

  it.each([
    [1, ["0", "1", "2"]],
    [3, ["0", "1", "2", "3", "4"]],
    [5, ["0", "1", "2", "3", "4", "5"]],
    [6, ["0", "5", "10"]],
    [30, ["0", "5", "10", "15", "20", "25", "30"]],
    [31, ["0", "10", "20", "30", "40"]],
    [60, ["0", "10", "20", "30", "40", "50", "60"]],
    [61, ["0", "15", "30", "45", "60", "75"]],
    [100, ["0", "20", "40", "60", "80", "100"]],
  ])(
    "with %i on the busiest day, ticks the count axis at %o",
    (busiest, ticks) => {
      const { container } = render(
        <ContributionLineChart
          graph={contributionGraph({ day: 3, month: 11, year: 2026 }, [
            0,
            busiest,
          ])}
        />,
      );

      expect(
        [...container.querySelectorAll('text[text-anchor="end"]')].map(
          (tick) => tick.textContent,
        ),
      ).toStrictEqual(ticks);
    },
  );

  it("draws the zero line solid and the other ticks' lines dashed", () => {
    const { container } = render(<ContributionLineChart graph={THREE_DAYS} />);

    expect(
      attributes(
        [...container.querySelectorAll("g > line")].slice(0, 2),
        "y1",
        "stroke-dasharray",
        "opacity",
      ),
    ).toStrictEqual([
      ["152", null, "0.6"],
      ["124", "3 3", "0.35"],
    ]);
  });

  it("marks every seventh day and the last with a gridline", () => {
    const { container } = render(
      <ContributionLineChart
        graph={contributionGraph(
          { day: 6, month: 10, year: 2026 },
          Array<number>(30).fill(1),
        )}
      />,
    );

    expect(
      attributes(container.querySelectorAll("svg > line"), "x1"),
    ).toStrictEqual([
      ["32"],
      ["191.3103448275862"],
      ["350.6206896551724"],
      ["509.9310344827586"],
      ["669.2413793103448"],
      ["692"],
    ]);
  });

  it("on hover, enlarges the day's dot and shows its count above it", () => {
    const { container } = render(<ContributionLineChart graph={THREE_DAYS} />);

    fireEvent.mouseEnter(findElement(container, "rect", { index: 1 }));

    expect([
      attributes(container.querySelectorAll("circle"), "r", "fill", "stroke"),
      container.querySelector('text[font-weight="700"]')?.textContent,
      container.querySelector('text[font-weight="700"]')?.getAttribute("y"),
      container.querySelector(".fill-text-primary:not([font-weight])")
        ?.textContent,
      container.querySelectorAll("g > line").length,
    ]).toStrictEqual([
      [
        ["3", "var(--color-text-muted)", null],
        ["5", "var(--color-accent-hover)", "var(--color-accent)"],
        ["3", "var(--color-text-muted)", null],
      ],
      "4",
      "30",
      "3",
      7,
    ]);
  });

  it("hides the count once the pointer leaves", () => {
    const { container } = render(<ContributionLineChart graph={THREE_DAYS} />);
    const day = findElement(container, "rect", { index: 1 });
    fireEvent.mouseEnter(day);

    fireEvent.mouseLeave(day);

    expect(container.querySelector('text[font-weight="700"]')).toBeNull();
  });

  it("toggles a day's count on a tap, without the mouse events that follow", () => {
    const { container } = render(<ContributionLineChart graph={THREE_DAYS} />);
    const day = findElement(container, "rect", { index: 2 });

    const followed = fireEvent.touchStart(day);
    const shown = container.querySelector(
      'text[font-weight="700"]',
    )?.textContent;
    fireEvent.touchStart(day);

    expect([
      followed,
      shown,
      container.querySelector('text[font-weight="700"]'),
    ]).toStrictEqual([false, "2", null]);
  });

  it("draws nothing for a graph without days", () => {
    const { container } = render(
      <ContributionLineChart
        graph={contributionGraph({ day: 4, month: 11, year: 2026 }, [])}
      />,
    );

    expect(container.innerHTML).toBe("");
  });

  it("draws the page's last 30 days as an island", () => {
    render(<ContributionLineChartIsland />);

    expect(screen.getByRole("img").querySelectorAll("circle")).toHaveLength(30);
  });
});
