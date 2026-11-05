/**
 * @file A chart's gridline: a faint line in the border colour, dashed unless
 * it is the chart's baseline.
 */

export function Gridline({
  dashed = true,
  opacity,
  x1 = 0,
  x2,
  y1,
  y2,
}: {
  dashed?: boolean;
  opacity: number;
  x1?: number;
  x2: number;
  y1: number;
  y2: number;
}) {
  return (
    <line
      opacity={opacity}
      stroke="var(--color-border)"
      strokeDasharray={dashed ? "3 3" : undefined}
      strokeWidth={0.5}
      x1={x1}
      x2={x2}
      y1={y1}
      y2={y2}
    />
  );
}
