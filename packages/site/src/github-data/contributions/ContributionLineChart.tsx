/**
 * @file The daily contributions line chart: the graph's last `DAYS_SHOWN` days
 * as a line over a shaded area, on a grid with a count axis and each day of
 * the month, and a day's count shown on hover or tap. The default export is
 * the live island.
 */

import type { ContributionGraph } from "@nusnus/github-data/contribution-graph";

import { liveIsland } from "../live/live-island.tsx";
import { formatIsoDate } from "../time/calendar-date.ts";
import { AxisLabel } from "./chart/AxisLabel.tsx";
import { useChartHover } from "./chart/chart-hover.ts";
import { ChartImage } from "./chart/ChartImage.tsx";
import { Gridline } from "./chart/Gridline.tsx";
import { HitArea } from "./chart/HitArea.tsx";
import { HoverValue } from "./chart/HoverValue.tsx";

export const DAYS_SHOWN = 30;
const CHART_WIDTH = 700;
const LEFT_PAD = 32;
const RIGHT_PAD = 8;
const TOP_PAD = 12;
const BOTTOM_PAD = 24;
const PLOT_WIDTH = CHART_WIDTH - LEFT_PAD - RIGHT_PAD;
const PLOT_HEIGHT = 140;
const PLOT_BOTTOM = TOP_PAD + PLOT_HEIGHT;
const SVG_HEIGHT = PLOT_BOTTOM + BOTTOM_PAD;
const DOT_RADIUS = 3;
const HOVERED_DOT_RADIUS = 5;
const DAYS_PER_GRIDLINE = 7;

export function ContributionLineChart({ graph }: { graph: ContributionGraph }) {
  const { handlers, hovered: hoveredIndex } = useChartHover<number>();
  const days = graph.weeks.flat().slice(-DAYS_SHOWN);
  if (days.length === 0) {
    return null;
  }

  const ticks = countTicks(
    Math.max(1, ...days.map(({ contributionCount }) => contributionCount)),
  );
  const topTick = Math.max(...ticks);
  const stepX = PLOT_WIDTH / Math.max(1, days.length - 1);
  // A lone day sits mid-plot, since one point spans no width.
  const x = (index: number) =>
    days.length === 1 ? LEFT_PAD + PLOT_WIDTH / 2 : LEFT_PAD + index * stepX;
  const y = (count: number) => PLOT_BOTTOM - (count / topTick) * PLOT_HEIGHT;
  const line = `M${days.map(({ contributionCount }, index) => `${String(x(index))},${String(y(contributionCount))}`).join(" L")}`;
  const area = `${line} L${String(x(days.length - 1))},${String(PLOT_BOTTOM)} L${String(x(0))},${String(PLOT_BOTTOM)} Z`;

  return (
    <ChartImage
      annotations={
        <div className="mt-1 flex items-center justify-between px-1">
          <span className="text-[9px] font-medium tracking-wider text-text-muted uppercase">
            Contributions
          </span>
          <span className="text-[9px] font-medium tracking-wider text-text-muted uppercase">
            Days
          </span>
        </div>
      }
      height={SVG_HEIGHT}
      label="Daily contribution line chart"
      width={CHART_WIDTH}
    >
      {ticks.map((tick) => (
        <g key={tick}>
          <Gridline
            dashed={tick !== 0}
            opacity={tick === 0 ? 0.6 : 0.35}
            x1={LEFT_PAD}
            x2={CHART_WIDTH - RIGHT_PAD}
            y1={y(tick)}
            y2={y(tick)}
          />
          <AxisLabel
            font="mono"
            fontSize={8}
            textAnchor="end"
            x={LEFT_PAD - 6}
            y={y(tick) + 3}
          >
            {tick}
          </AxisLabel>
        </g>
      ))}
      {days.map(
        ({ date }, index) =>
          (index % DAYS_PER_GRIDLINE === 0 || index === days.length - 1) && (
            <Gridline
              key={formatIsoDate(date)}
              opacity={0.25}
              x1={x(index)}
              x2={x(index)}
              y1={TOP_PAD}
              y2={PLOT_BOTTOM}
            />
          ),
      )}
      <path d={area} fill="var(--color-accent)" opacity={0.12} />
      <path
        d={line}
        fill="none"
        stroke="var(--color-accent)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
      {days.map(({ contributionCount, date }, index) => {
        const hovered = hoveredIndex === index;
        return (
          <g key={formatIsoDate(date)}>
            <HitArea
              height={PLOT_HEIGHT + BOTTOM_PAD}
              {...handlers(index)}
              width={stepX}
              x={x(index) - stepX / 2}
              y={TOP_PAD}
            />
            {hovered && (
              <line
                opacity={0.5}
                stroke="var(--color-text-muted)"
                strokeWidth={0.5}
                x1={x(index)}
                x2={x(index)}
                y1={TOP_PAD}
                y2={PLOT_BOTTOM}
              />
            )}
            <circle
              className="transition-all duration-100 motion-reduce:transition-none"
              cx={x(index)}
              cy={y(contributionCount)}
              fill={
                hovered
                  ? "var(--color-accent-hover)"
                  : "var(--color-text-muted)"
              }
              r={hovered ? HOVERED_DOT_RADIUS : DOT_RADIUS}
              stroke={hovered ? "var(--color-accent)" : undefined}
              // Not the default of 1, so the ring grows from nothing as
              // `transition-all` animates a hover.
              strokeWidth={hovered ? 2 : 0}
            />
            {hovered && (
              <HoverValue
                fontSize={10}
                fontWeight={700}
                value={contributionCount}
                x={x(index)}
                y={y(contributionCount) - 10}
              />
            )}
            <AxisLabel
              fontSize={7.5}
              hovered={hovered}
              textAnchor="middle"
              x={x(index)}
              y={PLOT_BOTTOM + 14}
            >
              {date.day}
            </AxisLabel>
          </g>
        );
      })}
    </ChartImage>
  );
}

export default liveIsland(ContributionLineChart, ({ snapshot }) => ({
  graph: snapshot.contributionGraph.data,
}));

function countTicks(highest: number): number[] {
  // At most six steps above zero, each a round count. While the busiest day
  // has at most 5, a tick per count, up to one above it but no higher than 5;
  // up to 30, steps of 5; up to 60, steps of 10; beyond, the smallest
  // multiple of 5 that reaches the busiest day in five steps.
  if (highest <= 5) {
    return Array.from(
      { length: Math.min(5, highest + 1) + 1 },
      (_, index) => index,
    );
  }
  const step =
    highest <= 30 ? 5 : highest <= 60 ? 10 : Math.ceil(highest / 25) * 5;
  return Array.from(
    { length: Math.ceil(highest / step) + 1 },
    (_, index) => index * step,
  );
}
