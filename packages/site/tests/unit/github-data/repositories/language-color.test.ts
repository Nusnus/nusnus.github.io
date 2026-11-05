/**
 * @file A language's dot takes GitHub's colour for it, or muted grey for one it
 * lacks.
 */

import { describe, expect, it } from "vitest";

import { languageColor } from "../../../../src/github-data/repositories/language-color.ts";

describe("languageColor", () => {
  it.each([
    ["C", "#555555"],
    ["C++", "#f34b7d"],
    ["CSS", "#663399"],
    ["Go", "#00ADD8"],
    ["HTML", "#e34c26"],
    ["JavaScript", "#f1e05a"],
    ["Python", "#3572A5"],
    ["Rust", "#dea584"],
    ["Shell", "#89e051"],
    ["TypeScript", "#3178c6"],
    ["Brainfuck", "var(--color-text-muted)"],
    ["constructor", "var(--color-text-muted)"],
  ])("colours %s %s", (language, color) => {
    expect(languageColor(language)).toBe(color);
  });
});
