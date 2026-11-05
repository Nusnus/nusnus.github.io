/**
 * @file A chart's axis label: small muted text, such as a month's name or a
 * count, in the sans font unless it is a figure set in the mono font, and
 * primary while its datum is hovered.
 */

import type { ReactNode } from "react";

export function AxisLabel({
  children,
  font = "sans",
  fontSize,
  hovered = false,
  textAnchor,
  x,
  y,
}: {
  children: ReactNode;
  font?: "mono" | "sans";
  fontSize: number;
  hovered?: boolean;
  textAnchor?: "end" | "middle";
  x?: number;
  y: number;
}) {
  return (
    <text
      className={hovered ? "fill-text-primary" : "fill-text-muted"}
      fontFamily={`var(--font-${font})`}
      fontSize={fontSize}
      textAnchor={textAnchor}
      x={x}
      y={y}
    >
      {children}
    </text>
  );
}
