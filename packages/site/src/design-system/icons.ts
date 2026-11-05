/**
 * @file The site's icons, from the one home of the lucide icon library: its
 * own icons, and the few the site draws through lucide because lucide's
 * version looks different, namely the menu's three full-width lines and
 * GitHub's filled star and fork, from its Octicons. Brand logos, which lucide
 * does not draw, are in `BrandIcon.astro`.
 */

import { createLucideIcon } from "lucide-react";

export {
  Activity,
  ArrowLeft,
  ArrowRight,
  CircleCheck,
  CirclePlus,
  ExternalLink,
  GitCommitHorizontal,
  GitPullRequest,
  type LucideIcon,
  MessageSquare,
  Moon,
  Sun,
  X,
} from "lucide-react";

export const Menu = createLucideIcon({
  name: "menu",
  node: [
    [
      "line",
      {
        // React needs a key on each shape, which nothing on the page reads.
        // Stryker disable next-line StringLiteral
        key: "top",
        x1: "3",
        x2: "21",
        y1: "6",
        y2: "6",
      },
    ],
    [
      "line",
      {
        // React needs a key on each shape, which nothing on the page reads.
        // Stryker disable next-line StringLiteral
        key: "middle",
        x1: "3",
        x2: "21",
        y1: "12",
        y2: "12",
      },
    ],
    [
      "line",
      {
        // React needs a key on each shape, which nothing on the page reads.
        // Stryker disable next-line StringLiteral
        key: "bottom",
        x1: "3",
        x2: "21",
        y1: "18",
        y2: "18",
      },
    ],
  ],
});

// Octicons are filled shapes on a 16-unit grid, where lucide's icons are
// strokes on a 24-unit one: https://primer.style/octicons/
export const StarFill = createLucideIcon({
  name: "star-fill",
  node: [
    [
      "path",
      {
        d: "M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z",
        fill: "currentColor",
        // React needs a key on each shape, which nothing on the page reads.
        // Stryker disable next-line StringLiteral
        key: "star",
        stroke: "none",
      },
    ],
  ],
  size: 16,
});

export const RepoForked = createLucideIcon({
  name: "repo-forked",
  node: [
    [
      "path",
      {
        d: "M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75v-.878a2.25 2.25 0 111.5 0v.878a2.25 2.25 0 01-2.25 2.25h-1.5v2.128a2.251 2.251 0 11-1.5 0V8.5h-1.5A2.25 2.25 0 013.5 6.25v-.878a2.25 2.25 0 111.5 0z",
        fill: "currentColor",
        // React needs a key on each shape, which nothing on the page reads.
        // Stryker disable next-line StringLiteral
        key: "fork",
        stroke: "none",
      },
    ],
  ],
  size: 16,
});
