/** @file Links open in a new tab exactly when they lead off the site. */

import { describe, expect, it } from "vitest";

import { linkTarget } from "../../../src/design-system/link-target.ts";

describe("linkTarget", () => {
  it.each(["https://github.com/celery", "http://example.com"])(
    "opens %s in a new tab that cannot reach back to this one",
    (href) => {
      expect(linkTarget(href)).toStrictEqual({
        rel: "noopener noreferrer",
        target: "_blank",
      });
    },
  );

  it.each([
    "/articles/x/",
    "#writing",
    "mailto:someone@example.com",
    "./https://x",
  ])("opens %s in place", (href) => {
    expect(linkTarget(href)).toStrictEqual({});
  });
});
