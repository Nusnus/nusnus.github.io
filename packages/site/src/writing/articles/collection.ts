/**
 * @file Every article, newest first, read from Astro's `articles` content
 * collection, which `content.config.ts` defines.
 */

import { getCollection } from "astro:content";

import { type Article, newestFirst } from "./article.ts";

export async function loadArticles(): Promise<Article[]> {
  return newestFirst(await getCollection("articles"));
}
