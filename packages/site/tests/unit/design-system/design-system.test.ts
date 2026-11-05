/**
 * @file The design system's stylesheet, as far as a copy of it outside any
 * stylesheet goes: the favicon, which loads on its own, draws in the dark
 * theme's base and accent colours, which it copies.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("design-system.css", () => {
  it("holds the dark theme's base and accent colours the favicon copies", () => {
    const theme = read("../../../src/design-system/design-system.css");
    const favicon = read("../../../public/favicon.svg");

    expect([
      ["bg-base", "accent"].map(
        (token) =>
          new RegExp(`--color-${token}: ([^;]+);`).exec(theme)?.[1] ?? "none",
      ),
      [...favicon.matchAll(/fill="([^"]+)"/g)].map(([, fill]) => fill),
    ]).toStrictEqual([
      ["oklch(0.1 0.008 255)", "oklch(0.72 0.17 145)"],
      ["oklch(0.1 0.008 255)", "oklch(0.72 0.17 145)"],
    ]);
  });
});
