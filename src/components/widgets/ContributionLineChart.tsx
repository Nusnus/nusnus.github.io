import { useState, useCallback, useMemo } from 'react';
import type { ContributionWeek, ContributionGraphData } from '@lib/github/types';
import { useLiveData } from '@hooks/useLiveData';

interface Props {
  weeks: ContributionWeek[];
}

interface DayPoint {
  date: string;
  dayLabel: string;
  count: number;
}

interface HoveredPoint {
  index: number;
  date: string;
  count: number;
}

const LEFT_PAD = 32;
const RIGHT_PAD = 8;
const TOP_PAD = 12;
const BOTTOM_PAD = 24;
const CHART_HEIGHT = 140;
const DOT_RADIUS = 3;
const DOT_HOVER_RADIUS = 5;

/** Extract the last N days from the weekly data. */
function extractDays(weeks: ContributionWeek[], count: number): DayPoint[] {
  const all: DayPoint[] = [];
  for (const week of weeks) {
    for (const day of week.contributionDays) {
      const d = new Date(day.date);
      all.push({
        date: day.date,
        dayLabel: String(d.getDate()),
        count: day.contributionCount,
      });
    }
  }
  return all.slice(-count);
}

/** Generate nice Y-axis tick values. */
function getYTicks(max: number): number[] {
  if (max <= 5) return [0, 1, 2, 3, 4, 5].filter((v) => v <= max + 1);
  const step = max <= 15 ? 5 : max <= 30 ? 5 : max <= 60 ? 10 : Math.ceil(max / 5 / 5) * 5;
  const ticks: number[] = [0];
  let v = step;
  while (v <= max) {
    ticks.push(v);
    v += step;
  }
  const lastTick = ticks[ticks.length - 1];
  if (lastTick !== undefined && lastTick < max) ticks.push(Math.ceil(max / step) * step);
  return ticks;
}

export default function ContributionLineChart({ weeks: initialWeeks }: Props) {
  const liveWeeks = useLiveData<ContributionGraphData, ContributionWeek[]>(
    'live-data:contributions',
    useCallback((data) => data?.weeks, []),
  );
  const [hovered, setHovered] = useState<HoveredPoint | null>(null);

  const weeks = liveWeeks ?? initialWeeks;

  const days = useMemo(() => extractDays(weeks, 30), [weeks]);
  const maxCount = useMemo(() => Math.max(...days.map((d) => d.count), 1), [days]);
  const yTicks = useMemo(() => getYTicks(maxCount), [maxCount]);
  const yMax = yTicks[yTicks.length - 1] || 1;

  const handleEnter = useCallback((index: number, date: string, count: number) => {
    setHovered({ index, date, count });
  }, []);
  const handleLeave = useCallback(() => setHovered(null), []);

  /** Touch handler for mobile — tap to show, tap again to dismiss */
  const handleTouch = useCallback(
    (e: React.TouchEvent, index: number, date: string, count: number) => {
      e.preventDefault();
      if (hovered?.index === index) {
        setHovered(null);
      } else {
        setHovered({ index, date, count });
      }
    },
    [hovered],
  );

  if (days.length === 0) return null;

  const n = days.length;
  const chartW = 700;
  const plotW = chartW - LEFT_PAD - RIGHT_PAD;
  const stepX = plotW / (n - 1);
  const svgW = chartW;
  const svgH = TOP_PAD + CHART_HEIGHT + BOTTOM_PAD;

  const px = (i: number) => LEFT_PAD + i * stepX;
  const py = (count: number) => TOP_PAD + CHART_HEIGHT - (count / yMax) * CHART_HEIGHT;

  // Build the line path and area path
  const linePoints = days.map((d, i) => `${px(i)},${py(d.count)}`);
  const linePath = `M${linePoints.join(' L')}`;
  const areaPath = `${linePath} L${px(n - 1)},${py(0)} L${px(0)},${py(0)} Z`;

  return (
    <div className="relative" role="img" aria-label="Daily contribution line chart">
      <svg
        width="100%"
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="overflow-visible"
        style={{ shapeRendering: 'geometricPrecision' }}
      >
        {/* Horizontal grid lines + Y labels */}
        {yTicks.map((tick) => {
          const y = py(tick);
          return (
            <g key={`y-${tick}`}>
              <line
                x1={LEFT_PAD}
                y1={y}
                x2={svgW - RIGHT_PAD}
                y2={y}
                stroke="var(--color-border)"
                strokeWidth={0.5}
                strokeDasharray={tick === 0 ? 'none' : '3 3'}
                opacity={tick === 0 ? 0.6 : 0.35}
              />
              <text
                x={LEFT_PAD - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-text-muted"
                fontSize={8}
                fontFamily="var(--font-mono)"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {/* Vertical grid lines */}
        {days.map((_, i) => {
          if (i % 7 !== 0 && i !== n - 1) return null;
          return (
            <line
              key={`vg-${i}`}
              x1={px(i)}
              y1={TOP_PAD}
              x2={px(i)}
              y2={TOP_PAD + CHART_HEIGHT}
              stroke="var(--color-border)"
              strokeWidth={0.5}
              strokeDasharray="3 3"
              opacity={0.25}
            />
          );
        })}

        {/* Filled area under the line */}
        <path d={areaPath} fill="var(--color-accent)" opacity={0.12} />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Dots + hit areas + day labels */}
        {days.map((day, i) => {
          const cx = px(i);
          const cy = py(day.count);
          const isHov = hovered?.index === i;

          return (
            <g key={day.date}>
              {/* Invisible hit area */}
              <rect
                x={cx - stepX / 2}
                y={TOP_PAD}
                width={stepX}
                height={CHART_HEIGHT + BOTTOM_PAD}
                fill="transparent"
                onMouseEnter={() => handleEnter(i, day.date, day.count)}
                onMouseLeave={handleLeave}
                onTouchStart={(e) => handleTouch(e, i, day.date, day.count)}
              />
              {/* Hover vertical line */}
              {isHov && (
                <line
                  x1={cx}
                  y1={TOP_PAD}
                  x2={cx}
                  y2={TOP_PAD + CHART_HEIGHT}
                  stroke="var(--color-text-muted)"
                  strokeWidth={0.5}
                  opacity={0.5}
                />
              )}
              {/* Dot */}
              <circle
                cx={cx}
                cy={cy}
                r={isHov ? DOT_HOVER_RADIUS : DOT_RADIUS}
                fill={isHov ? 'var(--color-accent-hover)' : 'var(--color-text-muted)'}
                stroke={isHov ? 'var(--color-accent)' : 'none'}
                strokeWidth={isHov ? 2 : 0}
                className="transition-all duration-100 motion-reduce:transition-none"
              />
              {/* Value label on hover */}
              {isHov && (
                <text
                  x={cx}
                  y={cy - 10}
                  textAnchor="middle"
                  className="fill-text-primary"
                  fontSize={10}
                  fontWeight={700}
                  fontFamily="var(--font-mono)"
                >
                  {day.count}
                </text>
              )}
              {/* Day label on X axis */}
              <text
                x={cx}
                y={TOP_PAD + CHART_HEIGHT + 14}
                textAnchor="middle"
                className={isHov ? 'fill-text-primary' : 'fill-text-muted'}
                fontSize={7.5}
                fontFamily="var(--font-sans)"
                opacity={n <= 30 || i % 2 === 0 ? 1 : 0}
              >
                {day.dayLabel}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Axis labels */}
      <div className="mt-1 flex items-center justify-between px-1">
        <span className="text-text-muted text-[9px] font-medium tracking-wider uppercase">
          Contributions
        </span>
        <span className="text-text-muted text-[9px] font-medium tracking-wider uppercase">
          Days
        </span>
      </div>
    </div>
  );
}
