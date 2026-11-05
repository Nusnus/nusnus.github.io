/**
 * @file The site's content collections, which Astro loads at build time.
 *
 * `articles` holds one Markdown file per article in `src/content/articles/`,
 * named for the article's id, its front matter following `frontMatterSchema`.
 * Add an article by adding its file: give it a body to give it a page of its
 * own, or front matter only to link it on LinkedIn.
 */

import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";

import { frontMatterSchema } from "./writing/articles/article.ts";

export const collections = {
  articles: defineCollection({
    // The glob loader keeps where it reads from to itself, so only the smoke
    // tests' build, which renders every article, tells these options apart.
    // Stryker disable next-line StringLiteral,ObjectLiteral
    loader: glob({ base: "./src/content/articles", pattern: "*.md" }),
    schema: frontMatterSchema,
  }),
};
