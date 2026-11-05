/**
 * @file Hovering a chart's datum, such as a day or a month: the pointer shows
 * the datum while it rests on its element, and a tap shows it or, tapped again,
 * hides it, without the mouse events a browser sends after a tap, which would
 * show it again. `handlers` gives the element that shows a datum its handlers.
 */

import { type TouchEvent, useState } from "react";

/** The handlers that hover one datum, on the element that shows it. */
export interface HoverHandlers {
  readonly onMouseEnter: () => void;
  readonly onMouseLeave: () => void;
  readonly onTouchStart: (event: TouchEvent) => void;
}

/** The datum hovered, if any, and the handlers that hover each. */
export interface ChartHover<Datum> {
  readonly hovered: Datum | null;
  readonly handlers: (datum: Datum) => HoverHandlers;
}

export function useChartHover<Datum>(
  isSame: (first: Datum, second: Datum) => boolean = Object.is,
): ChartHover<Datum> {
  const [hovered, setHovered] = useState<Datum | null>(null);
  return {
    hovered,
    handlers: (datum) => ({
      onMouseEnter: () => {
        setHovered(datum);
      },
      onMouseLeave: () => {
        setHovered(null);
      },
      onTouchStart: (event) => {
        event.preventDefault();
        setHovered(hovered !== null && isSame(hovered, datum) ? null : datum);
      },
    }),
  };
}
