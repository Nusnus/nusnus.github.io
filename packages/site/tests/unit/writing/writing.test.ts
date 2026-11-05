/**
 * @file Tomer's writing, beyond what the feed's tests show of its summary and
 * title: the feed and the Writing page keep the paths that links and feed
 * readers already hold.
 */

import { describe, expect, it } from "vitest";

import { WRITING } from "../../../src/writing/writing.ts";

describe("WRITING", () => {
  it("serves the feed at /rss.xml and the Writing page at /blog/, where links already point", () => {
    expect([WRITING.feedPath, WRITING.pagePath]).toStrictEqual([
      "/rss.xml",
      "/blog/",
    ]);
  });
});
