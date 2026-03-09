import { useState, useCallback, useMemo } from 'react';
import type { ContributionWeek, ContributionGraphData } from '@lib/github/types';
import { MONTH_NAMES } from '@lib/utils/date';
import { useLiveData } from '@hooks/useLiveData';

interface Props {
  weeks: ContributionWeek[];
}

interface MonthBucket {
  label: string;
  total: number;
  year: number;
  month: number;
}

interface HoveredBar {
  index: number;
  label: string;
  total: number;
}

/** Aggregate weekly contribution data into monthly buckets. */
function aggregateByMonth(weeks: ContributionWeek[]): MonthBucket[] {
  const map = new Map<string, MonthBucket>();
  for (const week of weeks) {
    for (const day of week.contributionDays) {
      const d = new Date(day.date);
      const year = d.getFullYear();
      const month = d.getMonth();
      const key = `${year}-${month}`;
      if (!map.has(key)) {
        map.set(key, { label: MONTH_NAMES[month] ?? '', total: 0, year, month });
      }
      const bucket = map.get(key);
      if (bucket) bucket.total += day.contributionCount;
    }
  }
  return Array.from(map.values()).sort((a, b) => a.year - b.year || a.month - b.month);
}

const CHART_HEIGHT = 120;
const BAR_RADIUS = 3;
const LABEL_HEIGHT = 20;
const TOP_PAD = 24;

export default function ActivityGraph({ weeks: initialWeeks }: Props) {
  const liveWeeks = useLiveData<ContributionGraphData, ContributionWeek[]>(
    'live-data:contributions',
    useCallback((data) => data?.weeks, []),
  );
  const [hovered, setHovered] = useState<HoveredBar | null>(null);

  const weeks = liveWeeks ?? initialWeeks;

  const buckets = useMemo(() => aggregateByMonth(weeks), [weeks]);
  const maxTotal = useMemo(() => Math.max(...buckets.map((b) => b.total), 1), [buckets]);

  const handleMouseEnter = useCallback((index: number, label: string, total: number) => {
    setHovered({ index, label, total });
  }, []);
  const handleMouseLeave = useCallback(() => setHovered(null), []);

  if (buckets.length === 0) return null;

  const barCount = buckets.length;
  const gap = 4;
  const barWidth = Math.max(8, (600 - gap * (barCount - 1)) / barCount);
  const svgWidth = barCount * (barWidth + gap) - gap;
  const svgHeight = TOP_PAD + CHART_HEIGHT + LABEL_HEIGHT;

  return (
    <div className="relative" role="img" aria-label="Monthly GitHub activity chart">
      <svg
        width="100%"
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="overflow-visible"
        style={{ shapeRendering: 'geometricPrecision' }}
      >
        {/* Horizontal grid lines */}
        {[0.25, 0.5, 0.75].map((frac) => {
          const y = TOP_PAD + CHART_HEIGHT * (1 - frac);
          return (
            <line
              key={frac}
              x1={0}
              y1={y}
              x2={svgWidth}
              y2={y}
              stroke="var(--color-border)"
              strokeWidth={0.5}
              strokeDasharray="3 3"
              opacity={0.5}
            />
          );
        })}

        {/* Bars */}
        {buckets.map((bucket, i) => {
          const barH = (bucket.total / maxTotal) * CHART_HEIGHT;
          const x = i * (barWidth + gap);
          const y = TOP_PAD + CHART_HEIGHT - barH;
          const isHovered = hovered?.index === i;

          return (
            <g key={`${bucket.year}-${bucket.month}`}>
              {/* Invisible hit area */}
              <rect
                x={x}
                y={TOP_PAD}
                width={barWidth}
                height={CHART_HEIGHT + LABEL_HEIGHT}
                fill="transparent"
                onMouseEnter={() =>
                  handleMouseEnter(i, `${bucket.label} ${bucket.year}`, bucket.total)
                }
                onMouseLeave={handleMouseLeave}
              />
              {/* Bar */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                rx={BAR_RADIUS}
                fill={isHovered ? 'var(--color-accent-hover)' : 'var(--color-accent)'}
                opacity={hovered && !isHovered ? 0.35 : isHovered ? 1 : 0.7}
                className="pointer-events-none transition-opacity duration-100 motion-reduce:transition-none"
              />
              {/* Value on hover */}
              {isHovered && (
                <text
                  x={x + barWidth / 2}
                  y={y - 6}
                  textAnchor="middle"
                  className="fill-text-primary"
                  fontSize={9}
                  fontWeight={600}
                  fontFamily="var(--font-mono)"
                >
                  {bucket.total}
                </text>
              )}
              {/* Month label */}
              <text
                x={x + barWidth / 2}
                y={TOP_PAD + CHART_HEIGHT + 14}
                textAnchor="middle"
                className={isHovered ? 'fill-text-primary' : 'fill-text-muted'}
                fontSize={8}
                fontFamily="var(--font-sans)"
              >
                {bucket.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
