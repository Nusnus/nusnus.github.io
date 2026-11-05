/**
 * @file The icons the site draws through lucide: the menu's three full-width
 * lines, and GitHub's filled star and fork on their 16-unit grid, each named
 * by its class and hidden from screen readers as lucide's own are.
 */

import { describe, expect, it } from "vitest";

import {
  Menu,
  RepoForked,
  StarFill,
} from "../../../src/design-system/icons.ts";
import { findElement, render } from "../../fixtures/unit-page.ts";

function drawing(svg: SVGElement): (null | string)[][] {
  return [...svg.children].map((shape) =>
    shape
      .getAttributeNames()
      .toSorted()
      .map((name) => `${name}=${String(shape.getAttribute(name))}`),
  );
}

describe("Menu", () => {
  it("draws three full-width lines on lucide's 24-unit grid", () => {
    const svg = findElement(render(<Menu />).container, "svg", {
      type: SVGElement,
    });

    expect([
      svg.getAttribute("class"),
      svg.getAttribute("viewBox"),
      svg.getAttribute("aria-hidden"),
      drawing(svg),
    ]).toStrictEqual([
      "lucide lucide-menu",
      "0 0 24 24",
      "true",
      [
        ["x1=3", "x2=21", "y1=6", "y2=6"],
        ["x1=3", "x2=21", "y1=12", "y2=12"],
        ["x1=3", "x2=21", "y1=18", "y2=18"],
      ],
    ]);
  });
});

describe.each([
  [
    "StarFill",
    StarFill,
    "lucide lucide-star-fill",
    "d=M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z",
  ],
  [
    "RepoForked",
    RepoForked,
    "lucide lucide-repo-forked",
    "d=M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75v-.878a2.25 2.25 0 111.5 0v.878a2.25 2.25 0 01-2.25 2.25h-1.5v2.128a2.251 2.251 0 11-1.5 0V8.5h-1.5A2.25 2.25 0 013.5 6.25v-.878a2.25 2.25 0 111.5 0z",
  ],
])("%s", (_, Icon, classes, shape) => {
  it("fills GitHub's shape on its 16-unit grid", () => {
    const svg = findElement(render(<Icon />).container, "svg", {
      type: SVGElement,
    });

    expect([
      svg.getAttribute("class"),
      svg.getAttribute("viewBox"),
      svg.getAttribute("aria-hidden"),
      drawing(svg),
    ]).toStrictEqual([
      classes,
      "0 0 16 16",
      "true",
      [[shape, "fill=currentColor", "stroke=none"]],
    ]);
  });
});
