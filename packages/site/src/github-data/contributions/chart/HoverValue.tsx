/**
 * @file The value of a chart's hovered datum, such as a day's count: bold
 * figures in the mono font, centred above the datum's mark.
 */

export function HoverValue({
  fontSize,
  fontWeight,
  value,
  x,
  y,
}: {
  fontSize: number;
  fontWeight: number;
  value: number;
  x: number;
  y: number;
}) {
  return (
    <text
      className="fill-text-primary"
      fontFamily="var(--font-mono)"
      fontSize={fontSize}
      fontWeight={fontWeight}
      textAnchor="middle"
      x={x}
      y={y}
    >
      {value}
    </text>
  );
}
