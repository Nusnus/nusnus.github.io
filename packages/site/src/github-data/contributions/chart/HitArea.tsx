/**
 * @file The area of a chart that hovers one datum: an invisible rectangle,
 * larger than the datum's mark, that takes the pointer and taps for it.
 */

import type { HoverHandlers } from "./chart-hover.ts";

export function HitArea(
  area: HoverHandlers & {
    height: number;
    width: number;
    x: number;
    y: number;
  },
) {
  return <rect fill="transparent" {...area} />;
}
