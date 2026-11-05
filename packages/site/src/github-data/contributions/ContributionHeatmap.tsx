/**
 * @file The contribution heatmap: a year of days as cells in week columns,
 * shaded by Tomer's contribution level that day, with month and weekday
 * labels, a legend, and each day's count in a tooltip on hover or tap. The
 * default export is the live island; `ContributionHeatmap` draws a given graph,
 * as the static background texture behind the contribution overview does.
 */

import { type Weekday, weekdayOf } from "@nusnus/github-data/calendar";
import {
  type ContributionDay,
  type ContributionGraph,
} from "@nusnus/github-data/contribution-graph";

import { tw } from "../../design-system/tailwind.ts";
import { liveIsland } from "../live/live-island.tsx";
import {
  formatLongDate,
  formatShortMonth,
  formatShortWeekday,
} from "../time/calendar-date.ts";
import { AxisLabel } from "./chart/AxisLabel.tsx";
import { useChartHover } from "./chart/chart-hover.ts";
import { ChartImage } from "./chart/ChartImage.tsx";

/** A day's cell: the day, and the week column it sits in. */
interface HeatmapCell {
  readonly day: ContributionDay;
  readonly weekIndex: number;
}

const CELL_SIZE = 10;
const CELL_RADIUS = 2.5;
const CELL_GAP = 3;
const CELL_STEP = CELL_SIZE + CELL_GAP;
const LABEL_WIDTH = 28;
const MONTH_LABEL_HEIGHT = 16;
const SVG_HEIGHT = MONTH_LABEL_HEIGHT + 7 * CELL_STEP;

// Every other row is labelled, as GitHub labels them.
const LABELLED_WEEKDAYS = [1, 3, 5] as const satisfies readonly Weekday[];

// Each level below the top: the most contributions a day at it has, and its
// colour; a day with more is at the top level.
const LEVELS = [
  { ceiling: 0, colorClass: tw`text-bg-elevated` },
  { ceiling: 3, colorClass: tw`text-contribution-1` },
  { ceiling: 6, colorClass: tw`text-contribution-2` },
  { ceiling: 10, colorClass: tw`text-contribution-3` },
] as const;

const TOP_LEVEL_COLOR_CLASS = tw`text-accent`;

// The tooltip stays inside the heatmap: it starts at its cell's left edge in
// the first third of the weeks, ends at its right edge in the last third, and
// is centred on it between.
const TOOLTIP_ALIGNMENTS = {
  center: { cellOffset: CELL_SIZE / 2, translate: tw`-translate-x-1/2` },
  end: { cellOffset: CELL_SIZE, translate: tw`-translate-x-full` },
  start: { cellOffset: 0, translate: "" },
} as const;

type TooltipAlignment =
  (typeof TOOLTIP_ALIGNMENTS)[keyof typeof TOOLTIP_ALIGNMENTS];

export function ContributionHeatmap({ graph }: { graph: ContributionGraph }) {
  const { totalContributions, weeks } = graph;
  const { handlers, hovered } = useChartHover(isSameCell);
  const svgWidth = LABEL_WIDTH + weeks.length * CELL_STEP;

  const tooltip =
    hovered === null
      ? null
      : {
          ...hovered,
          ...TOOLTIP_ALIGNMENTS[
            tooltipAlignment(hovered.weekIndex, weeks.length)
          ],
        };

  return (
    <ChartImage
      annotations={
        <>
          {tooltip !== null && (
            <HeatmapTooltip svgWidth={svgWidth} tooltip={tooltip} />
          )}
          <HeatmapLegend />
        </>
      }
      className="@container"
      height={SVG_HEIGHT}
      label={`GitHub contribution graph showing ${String(totalContributions)} contributions in the last year`}
      width={svgWidth}
    >
      {monthLabels(weeks).map(({ label, weekIndex }) => (
        <AxisLabel
          fontSize={9}
          key={weekIndex}
          x={LABEL_WIDTH + weekIndex * CELL_STEP}
          y={10}
        >
          {label}
        </AxisLabel>
      ))}
      {LABELLED_WEEKDAYS.map((weekday) => (
        <AxisLabel
          fontSize={9}
          key={weekday}
          y={MONTH_LABEL_HEIGHT + weekday * CELL_STEP + CELL_SIZE - 1}
        >
          {formatShortWeekday(weekday)}
        </AxisLabel>
      ))}
      <g
        // Styling the cells from here keeps a copy per cell out of the HTML.
        className="*:transition-opacity *:duration-100 motion-reduce:*:transition-none"
      >
        {weeks.map((week, weekIndex) =>
          week.map((day) => {
            const cell = { day, weekIndex };
            const highlighted = hovered !== null && isSameCell(hovered, cell);
            return (
              <rect
                className={`fill-current ${levelColorClass(day.contributionCount)}`}
                height={CELL_SIZE}
                key={weekdayOf(day.date)}
                {...handlers(cell)}
                opacity={hovered === null || highlighted ? undefined : 0.6}
                rx={CELL_RADIUS}
                stroke={highlighted ? "var(--color-text-secondary)" : undefined}
                width={CELL_SIZE}
                x={LABEL_WIDTH + weekIndex * CELL_STEP}
                y={MONTH_LABEL_HEIGHT + weekdayOf(day.date) * CELL_STEP}
              />
            );
          }),
        )}
      </g>
    </ChartImage>
  );
}

export default liveIsland(ContributionHeatmap, ({ snapshot }) => ({
  graph: snapshot.contributionGraph.data,
}));

function HeatmapTooltip({
  svgWidth,
  tooltip,
}: {
  svgWidth: number;
  tooltip: HeatmapCell & TooltipAlignment;
}) {
  return (
    <div
      className={`pointer-events-none absolute z-20 -translate-y-full rounded-md bg-bg-elevated px-2.5 py-1.5 text-xs whitespace-nowrap shadow-lg ring-1 ring-border ${tooltip.translate}`}
      style={{
        // The SVG fills the container's width, so a point in its viewBox sits
        // at the same fraction of that width across, and down: here, 8px
        // above the hovered cell.
        left: `${String(((LABEL_WIDTH + tooltip.weekIndex * CELL_STEP + tooltip.cellOffset) / svgWidth) * 100)}%`,
        top: `calc(${String(((MONTH_LABEL_HEIGHT + weekdayOf(tooltip.day.date) * CELL_STEP) / svgWidth) * 100)}cqw - 8px)`,
      }}
    >
      <span className="font-semibold text-text-primary">
        {tooltip.day.contributionCount}{" "}
        {tooltip.day.contributionCount === 1 ? "contribution" : "contributions"}
      </span>
      <span className="ml-1.5 text-text-secondary">
        {formatLongDate(tooltip.day.date)}
      </span>
    </div>
  );
}

function HeatmapLegend() {
  return (
    <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px]">
      <span className="mr-0.5 text-text-muted">Less</span>
      {[
        ...LEVELS.map(({ colorClass }) => colorClass),
        TOP_LEVEL_COLOR_CLASS,
      ].map((colorClass) => (
        <span
          className={`inline-block bg-current ${colorClass}`}
          key={colorClass}
          style={{
            borderRadius: CELL_RADIUS,
            height: CELL_SIZE,
            width: CELL_SIZE,
          }}
        />
      ))}
      <span className="ml-0.5 text-text-muted">More</span>
    </div>
  );
}

function isSameCell(first: HeatmapCell, second: HeatmapCell): boolean {
  return (
    first.weekIndex === second.weekIndex &&
    weekdayOf(first.day.date) === weekdayOf(second.day.date)
  );
}

function levelColorClass(contributionCount: number): string {
  return (
    LEVELS.find(({ ceiling }) => contributionCount <= ceiling)?.colorClass ??
    TOP_LEVEL_COLOR_CLASS
  );
}

function tooltipAlignment(
  weekIndex: number,
  weekCount: number,
): keyof typeof TOOLTIP_ALIGNMENTS {
  if (weekIndex < weekCount / 3) {
    return "start";
  }
  return weekIndex < (weekCount * 2) / 3 ? "center" : "end";
}

function monthLabels(
  weeks: ContributionGraph["weeks"],
): { label: string; weekIndex: number }[] {
  const labels: { label: string; weekIndex: number }[] = [];
  let previousMonth: number | undefined;
  for (const [weekIndex, [firstDay]] of weeks.entries()) {
    if (firstDay !== undefined && firstDay.date.month !== previousMonth) {
      labels.push({ label: formatShortMonth(firstDay.date), weekIndex });
      previousMonth = firstDay.date.month;
    }
  }
  return labels;
}
