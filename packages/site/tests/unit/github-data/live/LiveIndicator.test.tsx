/**
 * @file The live indicator: grey while the page shows the data it was built
 * with, green while live, amber while the worker is unavailable, and the same
 * in words for screen readers; the island follows the page's data.
 */

import { describe, expect, it } from "vitest";

import LiveIndicatorIsland, {
  LiveIndicator,
} from "../../../../src/github-data/live/LiveIndicator.tsx";
import { findElement, render } from "../../../fixtures/unit-page.ts";

describe("LiveIndicator", () => {
  it.each([
    [
      "baked",
      "bg-status-inactive",
      "Showing data from when the page was built",
    ],
    ["live", "bg-status-active", "Live"],
    ["stale", "bg-status-warning", "Live data unavailable, showing older data"],
  ] as const)(
    "while %s, shows a %s light and says so",
    (freshness, color, text) => {
      const { container } = render(<LiveIndicator freshness={freshness} />);

      expect([
        ...findElement(container, '[aria-hidden="true"]').classList,
      ]).toContain(color);
      expect(findElement(container, ".sr-only").textContent).toBe(text);
    },
  );

  it("is a small, still light", () => {
    const { container } = render(<LiveIndicator freshness="live" />);

    expect([
      [...findElement(container, '[aria-hidden="true"]').classList],
      container.querySelectorAll(".animate-pulse-dot").length,
    ]).toStrictEqual([expect.arrayContaining(["h-2", "w-2"]), 0]);
  });

  it("shows the page's freshness as an island", () => {
    const { container } = render(<LiveIndicatorIsland />);

    expect(container.textContent).toBe(
      "Showing data from when the page was built",
    );
  });
});
