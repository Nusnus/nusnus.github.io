/**
 * @file The site's identity, beyond what the pages' tests show of its URL and
 * name: the description a page without its own gives.
 */

import { describe, expect, it } from "vitest";

import { SITE_DESCRIPTION } from "../../src/site.ts";

describe("SITE_DESCRIPTION", () => {
  it("describes Tomer, and adds that he is an artist who codes", () => {
    expect(SITE_DESCRIPTION).toBe(
      "Software engineer and open source leader. Creator of pytest-celery, top contributor to Celery. Artist who codes.",
    );
  });
});
