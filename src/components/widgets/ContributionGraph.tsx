import { useState, useCallback } from 'react';
import type { ContributionWeek } from '@lib/github/types';
import { getActivityLevel } from '@lib/github/formatters';
import { formatDate } from '@lib/utils/date';

interface Props {
  weeks: ContributionWeek[];
  totalContributions: number;
}

const CELL_SIZE = 11;
const CELL_GAP = 2;
const CELL_STEP = CELL_SIZE + CELL_GAP;

const LEVEL_COLORS = [
  'var(--color-bg-elevated)',
  'oklch(0.45 0.10 145)',
  'oklch(0.55 0.14 145)',
  'oklch(0.65 0.17 145)',
  'var(--color-accent)',
];

interface HoveredCell {
  date: string;
  count: number;
  x: number;
  y: number;
}

export default function ContributionGraph({ weeks, totalContributions }: Props) {
  const [hovered, setHovered] = useState<HoveredCell | null>(null);

  const handleMouseEnter = useCallback((date: string, count: number, x: number, y: number) => {
    setHovered({ date, count, x, y });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHovered(null);
  }, []);

  const svgWidth = weeks.length * CELL_STEP;
  const svgHeight = 7 * CELL_STEP;

  return (
    <div
      className="relative"
      role="img"
      aria-label={`GitHub contribution graph showing ${totalContributions} contributions in the last year`}
    >
      <svg width="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="overflow-visible">
        {weeks.map((week, weekIndex) =>
          week.contributionDays.map((day) => {
            const level = getActivityLevel(day.contributionCount);
            const x = weekIndex * CELL_STEP;
            const y = day.weekday * CELL_STEP;

            return (
              <rect
                key={day.date}
                x={x}
                y={y}
                width={CELL_SIZE}
                height={CELL_SIZE}
                rx={2}
                fill={LEVEL_COLORS[level]}
                className="transition-transform duration-150 hover:scale-125 motion-reduce:transition-none"
                style={{ transformOrigin: `${x + CELL_SIZE / 2}px ${y + CELL_SIZE / 2}px` }}
                onMouseEnter={() => handleMouseEnter(day.date, day.contributionCount, x, y)}
                onMouseLeave={handleMouseLeave}
              />
            );
          }),
        )}
      </svg>

      {/* Tooltip */}
      {hovered && (
        <div
          className="bg-bg-elevated ring-border pointer-events-none absolute z-10 rounded-md px-2.5 py-1.5 text-xs shadow-lg ring-1"
          style={{
            left: `${(hovered.x / svgWidth) * 100}%`,
            top: `${hovered.y - 8}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <span className="text-text-primary font-medium">
            {hovered.count} contribution{hovered.count !== 1 ? 's' : ''}
          </span>
          <span className="text-text-muted ml-1">{formatDate(hovered.date)}</span>
        </div>
      )}
    </div>
  );
}
