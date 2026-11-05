/**
 * @file The presence dot: Tomer's presence as a status light, pulsing while he
 * was active today or yesterday, and in words for screen readers; the island
 * judges presence from the page's activity and clock.
 */

import { describe, expect, it } from "vitest";

import PresenceDotIsland, {
  PresenceDot,
} from "../../../../../src/github-data/activity/presence/PresenceDot.tsx";
import { findElement, render } from "../../../../fixtures/unit-page.ts";

describe("PresenceDot", () => {
  it.each([
    ["active", "bg-status-active", 2, 1, "Active today"],
    ["recent", "bg-status-warning", 2, 1, "Active yesterday"],
    ["away", "bg-status-inactive", 1, 0, "Away"],
  ] as const)(
    "while %s, colours %s %i shapes, pulses %i, and says so",
    (presence, color, coloured, pulsing, text) => {
      const { container } = render(<PresenceDot presence={presence} />);

      expect([
        container.querySelectorAll(`.${color}`).length,
        container.querySelectorAll(".animate-pulse-dot").length,
        findElement(container, ".sr-only").textContent,
      ]).toStrictEqual([coloured, pulsing, text]);
    },
  );

  it("is a light the size of the avatar's corner", () => {
    const { container } = render(<PresenceDot presence="away" />);

    expect([...findElement(container, "span").classList]).toStrictEqual(
      expect.arrayContaining(["h-3.5", "w-3.5"]),
    );
  });

  it("judges the page's activity as an island", () => {
    const { container } = render(<PresenceDotIsland />);

    expect(findElement(container, ".sr-only").textContent).toBe("Active today");
  });
});
