/**
 * @file A chart's hit area: an invisible rectangle where it is placed, which
 * hovers its datum while the pointer is over it or a tap lands on it.
 */

import { describe, expect, it, vi } from "vitest";

import { HitArea } from "../../../../../src/github-data/contributions/chart/HitArea.tsx";
import {
  findElement,
  fireEvent,
  render,
} from "../../../../fixtures/unit-page.ts";

describe("HitArea", () => {
  it("is an invisible rectangle where it is placed", () => {
    const rect = findElement(
      render(
        <svg>
          <HitArea
            height={120}
            onMouseEnter={vi.fn()}
            onMouseLeave={vi.fn()}
            onTouchStart={vi.fn()}
            width={12}
            x={30}
            y={8}
          />
        </svg>,
      ).container,
      "rect",
    );

    expect(
      ["fill", "height", "width", "x", "y"].map((name) =>
        rect.getAttribute(name),
      ),
    ).toStrictEqual(["transparent", "120", "12", "30", "8"]);
  });

  it("hovers its datum as the pointer enters, unhovers it as the pointer leaves, and hovers it on a tap", () => {
    const onMouseEnter = vi.fn();
    const onMouseLeave = vi.fn();
    const onTouchStart = vi.fn();
    const rect = findElement(
      render(
        <svg>
          <HitArea
            height={120}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onTouchStart={onTouchStart}
            width={12}
            x={30}
            y={8}
          />
        </svg>,
      ).container,
      "rect",
    );

    fireEvent.mouseEnter(rect);
    fireEvent.mouseLeave(rect);
    fireEvent.touchStart(rect);

    expect(
      [onMouseEnter, onMouseLeave, onTouchStart].map(
        (handler) => handler.mock.calls.length,
      ),
    ).toStrictEqual([1, 1, 1]);
  });
});
