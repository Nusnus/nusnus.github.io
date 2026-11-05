/**
 * @file The monthly breakdown: a bar for each calendar month the graph covers,
 * as tall as the month's contributions, with a month's total shown on hover or
 * tap. A year of days spans parts of one more calendar month than a year
 * holds, so a month the chart shows twice, at its start and its end, is
 * labelled with its year. The default export is the live island.
 */

import type { CalendarDate } from "@nusnus/github-data/calendar";
import type { ContributionGraph } from "@nusnus/github-data/contribution-graph";

import { liveIsland } from "../live/live-island.tsx";
import {
  formatShortMonth,
  formatShortMonthOfYear,
} from "../time/calendar-date.ts";
import { AxisLabel } from "./chart/AxisLabel.tsx";
import { useChartHover } from "./chart/chart-hover.ts";
import { ChartImage } from "./chart/ChartImage.tsx";
import { Gridline } from "./chart/Gridline.tsx";
import { HitArea } from "./chart/HitArea.tsx";
import { HoverValue } from "./chart/HoverValue.tsx";

const PLOT_HEIGHT = 120;
const TOP_PAD = 24;
const LABEL_HEIGHT = 20;
const SVG_HEIGHT = TOP_PAD + PLOT_HEIGHT + LABEL_HEIGHT;
const BAR_GAP = 4;
const MIN_BAR_WIDTH = 8;
const PREFERRED_BARS_WIDTH = 600;
const BAR_RADIUS = 3;
const BUSIEST_MONTH_GRIDLINES = [0.25, 0.5, 0.75] as const;

/**
 * A calendar month's contributions, summed as the graph's days are read: its
 * first day in the graph, which tells apart the two months of one name a year
 * of days can span, and its running total.
 */
interface MonthTotal {
  readonly firstDay: CalendarDate;
  total: number;
}

/** A month as its bar shows it: its label and its total. */
interface MonthBar {
  readonly label: string;
  readonly total: number;
}

export function MonthlyBreakdown({ graph }: { graph: ContributionGraph }) {
  const { handlers, hovered: hoveredIndex } = useChartHover<number>();
  const bars = monthBars(graph);
  if (bars.length === 0) {
    return null;
  }

  const busiestTotal = Math.max(1, ...bars.map(({ total }) => total));
  const barWidth = Math.max(
    MIN_BAR_WIDTH,
    (PREFERRED_BARS_WIDTH - BAR_GAP * (bars.length - 1)) / bars.length,
  );
  const svgWidth = bars.length * (barWidth + BAR_GAP) - BAR_GAP;

  return (
    <ChartImage
      height={SVG_HEIGHT}
      label="Monthly GitHub activity chart"
      width={svgWidth}
    >
      {BUSIEST_MONTH_GRIDLINES.map((fraction) => (
        <Gridline
          key={fraction}
          opacity={0.5}
          x2={svgWidth}
          y1={TOP_PAD + PLOT_HEIGHT * (1 - fraction)}
          y2={TOP_PAD + PLOT_HEIGHT * (1 - fraction)}
        />
      ))}
      {bars.map(({ label, total }, index) => {
        const hovered = hoveredIndex === index;
        const barHeight = (total / busiestTotal) * PLOT_HEIGHT;
        const x = index * (barWidth + BAR_GAP);
        const y = TOP_PAD + PLOT_HEIGHT - barHeight;
        return (
          <g key={label}>
            <HitArea
              height={PLOT_HEIGHT + LABEL_HEIGHT}
              {...handlers(index)}
              width={barWidth}
              x={x}
              y={TOP_PAD}
            />
            <rect
              className="pointer-events-none transition-opacity duration-100 motion-reduce:transition-none"
              fill={
                hovered ? "var(--color-accent-hover)" : "var(--color-accent)"
              }
              height={barHeight}
              opacity={barOpacity(hoveredIndex, index)}
              rx={BAR_RADIUS}
              width={barWidth}
              x={x}
              y={y}
            />
            {hovered && (
              <HoverValue
                fontSize={9}
                fontWeight={600}
                value={total}
                x={x + barWidth / 2}
                y={y - 6}
              />
            )}
            <AxisLabel
              fontSize={8}
              hovered={hovered}
              textAnchor="middle"
              x={x + barWidth / 2}
              y={TOP_PAD + PLOT_HEIGHT + 14}
            >
              {label}
            </AxisLabel>
          </g>
        );
      })}
    </ChartImage>
  );
}

export default liveIsland(MonthlyBreakdown, ({ snapshot }) => ({
  graph: snapshot.contributionGraph.data,
}));

function barOpacity(hoveredIndex: null | number, index: number): number {
  if (hoveredIndex === null) {
    return 0.7;
  }
  return hoveredIndex === index ? 1 : 0.35;
}

function monthBars(graph: ContributionGraph): MonthBar[] {
  const totalsByMonth = new Map<string, MonthTotal>();
  for (const { contributionCount, date } of graph.weeks.flat()) {
    const key = `${String(date.year)}-${String(date.month)}`;
    const monthTotal = totalsByMonth.get(key) ?? { firstDay: date, total: 0 };
    monthTotal.total += contributionCount;
    totalsByMonth.set(key, monthTotal);
  }
  const monthTotals = [...totalsByMonth.values()];
  return monthTotals.map(({ firstDay, total }) => ({
    label: monthTotals.some(
      (other) =>
        other.firstDay !== firstDay && other.firstDay.month === firstDay.month,
    )
      ? formatShortMonthOfYear(firstDay)
      : formatShortMonth(firstDay),
    total,
  }));
}
