/**
 * @file A status light: a dot of its colour and size, hidden from screen
 * readers, with a pulsing halo while its status is ongoing, and its meaning in
 * words for screen readers.
 */

import { describe, expect, it } from "vitest";

import { StatusLight } from "../../../src/design-system/StatusLight.tsx";
import { render } from "../../fixtures/unit-page.ts";

describe("StatusLight", () => {
  it("shows a dot of its colour and size, and says what it means", () => {
    const { container } = render(
      <StatusLight
        colorClass="bg-green"
        pulses={false}
        sizeClass="h-2 w-2"
        text="Live"
      />,
    );

    expect(
      [...container.querySelectorAll("span")].map((span) => [
        [...span.classList],
        span.getAttribute("aria-hidden"),
        span.textContent,
      ]),
    ).toStrictEqual([
      [expect.arrayContaining(["h-2", "w-2"]), null, "Live"],
      [expect.arrayContaining(["h-2", "w-2", "bg-green"]), "true", ""],
      [["sr-only"], null, "Live"],
    ]);
  });

  it("pulses a halo of its colour behind the dot while its status is ongoing", () => {
    const { container } = render(
      <StatusLight
        colorClass="bg-green"
        pulses
        sizeClass="h-2 w-2"
        text="Live"
      />,
    );

    expect(
      [...container.querySelectorAll(".animate-pulse-dot")].map((halo) => [
        [...halo.classList].includes("bg-green"),
        halo.getAttribute("aria-hidden"),
      ]),
    ).toStrictEqual([[true, "true"]]);
  });
});
