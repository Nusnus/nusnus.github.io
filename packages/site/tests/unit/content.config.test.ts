/**
 * @file The site's content collections: the articles, read by a glob loader
 * and checked by the front matter's schema.
 */

import { describe, expect, it } from "vitest";

import { collections } from "../../src/content.config.ts";
import { frontMatterSchema } from "../../src/writing/articles/article.ts";

describe("collections", () => {
  it("reads the articles with Astro's glob loader, checking their front matter", () => {
    expect(collections).toStrictEqual({
      articles: {
        loader: expect.objectContaining({ name: "glob-loader" }) as unknown,
        schema: frontMatterSchema,
      },
    });
  });
});
