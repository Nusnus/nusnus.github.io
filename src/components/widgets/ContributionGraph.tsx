import { useState, useCallback, useRef, useEffect } from 'react';
import type { ContributionWeek, ContributionGraphData } from '@lib/github/types';
import { getActivityLevel } from '@lib/github/formatters';
import { formatDate } from '@lib/utils/date';

interface Props {
  weeks: ContributionWeek[];
  totalContributions: number;
}

const CELL_SIZE = 10;
const CELL_GAP = 3;
const CELL_STEP = CELL_SIZE + CELL_GAP;
const LABEL_WIDTH = 28;
const MONTH_LABEL_HEIGHT = 16;
const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

const LEVEL_COLORS = [
  'var(--color-bg-elevated)',
  'oklch(0.40 0.10 145)',
  'oklch(0.50 0.14 145)',
  'oklch(0.62 0.17 145)',
  'var(--color-accent)',
];

interface HoveredCell {
  date: string;
  count: number;
  weekIndex: number;
  dayIndex: number;
}

/** Compute month label positions from the week data. */
function getMonthLabels(weeks: ContributionWeek[]) {
  const labels: { label: string; x: number }[] = [];
  let lastMonth = -1;
  for (let i = 0; i < weeks.length; i++) {
    const week = weeks[i];
    if (!week) continue;
    const firstDay = week.contributionDays[0];
    if (!firstDay) continue;
    const month = new Date(firstDay.date).getMonth();
    const monthLabel = MONTH_NAMES[month] ?? '';
    if (month !== lastMonth) {
      labels.push({ label: monthLabel, x: i * CELL_STEP + LABEL_WIDTH });
      lastMonth = month;
    }
  }
  return labels;
}

export default function ContributionGraph({
  weeks: initialWeeks,
  totalContributions: initialTotal,
}: Props) {
  const [liveWeeks, setLiveWeeks] = useState(initialWeeks);
  const [liveTotal, setLiveTotal] = useState(initialTotal);
  const [hovered, setHovered] = useState<HoveredCell | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltipPos, setTooltipPos] = useState<{ left: number; top: number } | null>(null);

  // Listen for live data updates from LiveData island
  useEffect(() => {
    function onLiveData(e: Event) {
      const data = (e as CustomEvent<ContributionGraphData>).detail;
      if (data?.weeks) setLiveWeeks(data.weeks);
      if (data?.totalContributions != null) setLiveTotal(data.totalContributions);
    }
    window.addEventListener('live-data:contributions', onLiveData);
    return () => window.removeEventListener('live-data:contributions', onLiveData);
  }, []);

  const weeks = liveWeeks;
  const totalContributions = liveTotal;

  const handleMouseEnter = useCallback(
    (date: string, count: number, weekIndex: number, dayIndex: number) => {
      setHovered({ date, count, weekIndex, dayIndex });
      // Compute pixel position from SVG element's actual rendered size
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const parentRect = svg.parentElement?.getBoundingClientRect();
      if (!parentRect) return;
      const scaleX = rect.width / (LABEL_WIDTH + weeks.length * CELL_STEP);
      const scaleY = rect.height / (MONTH_LABEL_HEIGHT + 7 * CELL_STEP);
      const cellCenterX = LABEL_WIDTH + weekIndex * CELL_STEP + CELL_SIZE / 2;
      const cellTopY = MONTH_LABEL_HEIGHT + dayIndex * CELL_STEP;
      setTooltipPos({
        left: rect.left - parentRect.left + cellCenterX * scaleX,
        top: rect.top - parentRect.top + cellTopY * scaleY,
      });
    },
    [weeks.length],
  );

  const handleMouseLeave = useCallback(() => {
    setHovered(null);
    setTooltipPos(null);
  }, []);

  const gridWidth = weeks.length * CELL_STEP;
  const svgWidth = LABEL_WIDTH + gridWidth;
  const svgHeight = MONTH_LABEL_HEIGHT + 7 * CELL_STEP;
  const monthLabels = getMonthLabels(weeks);

  return (
    <div
      className="relative"
      role="img"
      aria-label={`GitHub contribution graph showing ${totalContributions} contributions in the last year`}
    >
      <svg
        ref={svgRef}
        width="100%"
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="overflow-visible"
        style={{ shapeRendering: 'geometricPrecision' }}
      >
        {/* Month labels */}
        {monthLabels.map(({ label, x }) => (
          <text
            key={`month-${label}-${x}`}
            x={x}
            y={10}
            className="fill-text-muted"
            fontSize={9}
            fontFamily="var(--font-sans)"
          >
            {label}
          </text>
        ))}

        {/* Day-of-week labels */}
        {DAY_LABELS.map(
          (label, i) =>
            label && (
              <text
                key={`day-${i}`}
                x={0}
                y={MONTH_LABEL_HEIGHT + i * CELL_STEP + CELL_SIZE - 1}
                className="fill-text-muted"
                fontSize={9}
                fontFamily="var(--font-sans)"
              >
                {label}
              </text>
            ),
        )}

        {/* Contribution cells */}
        {weeks.map((week, weekIndex) =>
          week.contributionDays.map((day) => {
            const level = getActivityLevel(day.contributionCount);
            const x = LABEL_WIDTH + weekIndex * CELL_STEP;
            const y = MONTH_LABEL_HEIGHT + day.weekday * CELL_STEP;
            const isHovered = hovered?.weekIndex === weekIndex && hovered?.dayIndex === day.weekday;

            return (
              <rect
                key={day.date}
                x={x}
                y={y}
                width={CELL_SIZE}
                height={CELL_SIZE}
                rx={2.5}
                fill={LEVEL_COLORS[level]}
                stroke={isHovered ? 'var(--color-text-secondary)' : 'transparent'}
                strokeWidth={isHovered ? 1 : 0}
                opacity={hovered && !isHovered ? 0.6 : 1}
                className="transition-opacity duration-100 motion-reduce:transition-none"
                onMouseEnter={() =>
                  handleMouseEnter(day.date, day.contributionCount, weekIndex, day.weekday)
                }
                onMouseLeave={handleMouseLeave}
              />
            );
          }),
        )}
      </svg>

      {/* Tooltip */}
      {hovered && tooltipPos && (
        <div
          className="bg-bg-elevated ring-border pointer-events-none absolute z-20 rounded-md px-2.5 py-1.5 text-xs whitespace-nowrap shadow-lg ring-1"
          style={{
            left: `${tooltipPos.left}px`,
            top: `${tooltipPos.top - 8}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <span className="text-text-primary font-semibold">
            {hovered.count} contribution{hovered.count !== 1 ? 's' : ''}
          </span>
          <span className="text-text-muted ml-1.5">{formatDate(hovered.date)}</span>
        </div>
      )}

      {/* Legend */}
      <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px]">
        <span className="text-text-muted mr-0.5">Less</span>
        {LEVEL_COLORS.map((color, i) => (
          <span
            key={i}
            className="inline-block h-[10px] w-[10px] rounded-[2.5px]"
            style={{ backgroundColor: color }}
          />
        ))}
        <span className="text-text-muted ml-0.5">More</span>
      </div>
    </div>
  );
}
