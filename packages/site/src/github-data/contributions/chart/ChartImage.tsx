/**
 * @file A chart as one labelled image: its SVG drawing, as wide as its frame,
 * scaling a drawing of the given size to fit, its shapes rendered at full
 * precision and free to reach past its edges, such as a hovered value above
 * the plot; then its annotations, the HTML it shows beside the drawing, such
 * as a tooltip or a legend.
 */

import type { ReactNode } from "react";

export function ChartImage({
  annotations,
  children,
  className,
  height,
  label,
  width,
}: {
  annotations?: ReactNode;
  children: ReactNode;
  className?: string;
  height: number;
  label: string;
  width: number;
}) {
  return (
    <div
      aria-label={label}
      className={className === undefined ? "relative" : `relative ${className}`}
      role="img"
    >
      <svg
        className="overflow-visible"
        style={{ shapeRendering: "geometricPrecision" }}
        viewBox={`0 0 ${String(width)} ${String(height)}`}
        // Chrome sizes an SVG without a width from its height and aspect ratio,
        // a fraction of a pixel short of its container; 100% fills it exactly.
        width="100%"
      >
        {children}
      </svg>
      {annotations}
    </div>
  );
}
