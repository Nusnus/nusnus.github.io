/**
 * @file The articles collection, as the site reads it: every article, newest
 * first.
 */

import { describe, expect, it } from "vitest";

import { loadArticles } from "../../../../src/writing/articles/collection.ts";
import {
  LINKEDIN_ONLY,
  NEWER_WITH_PAGE,
  OLDER_WITH_PAGE,
} from "../../../fixtures/articles.ts";

describe("loadArticles", () => {
  it("gives every article, newest first", async () => {
    await expect(loadArticles()).resolves.toStrictEqual([
      LINKEDIN_ONLY,
      NEWER_WITH_PAGE,
      OLDER_WITH_PAGE,
    ]);
  });
});
