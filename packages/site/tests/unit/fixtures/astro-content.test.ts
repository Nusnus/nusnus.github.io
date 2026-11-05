/**
 * @file The fake `astro:content`: it hands over the fixture articles in no
 * date order, and no entries for another collection, and gives back each
 * collection's config.
 */

import { describe, expect, it } from "vitest";

import {
  LINKEDIN_ONLY,
  NEWER_WITH_PAGE,
  OLDER_WITH_PAGE,
} from "../../fixtures/articles.ts";
import {
  defineCollection,
  getCollection,
} from "../../fixtures/astro-content.ts";

describe("getCollection", () => {
  it("hands over the fixture articles, in no date order", async () => {
    await expect(getCollection("articles")).resolves.toStrictEqual([
      OLDER_WITH_PAGE,
      LINKEDIN_ONLY,
      NEWER_WITH_PAGE,
    ]);
  });

  it("hands over no entries for a collection the site does not define", async () => {
    await expect(getCollection("talks")).resolves.toStrictEqual([]);
  });
});

describe("defineCollection", () => {
  it("gives back the collection's config", () => {
    const config = { schema: "articles' schema" };

    expect(defineCollection(config)).toBe(config);
  });
});
