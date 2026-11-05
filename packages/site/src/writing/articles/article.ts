/**
 * @file An article Tomer wrote: the schema of its Markdown file's front matter,
 * and how the site orders, links, dates and times it.
 *
 * Every article first appeared on LinkedIn. One whose file has a body also has
 * a page of its own here, at `/articles/<id>/`, and the site links there; one
 * whose file has front matter only is linked on LinkedIn.
 */

import type { CollectionEntry } from "astro:content";

// Astro's content collections take a schema built with Astro's own zod.
import { z } from "astro/zod";

import { LONG_DATE } from "../../locale.ts";

export const frontMatterSchema = z.object({
  description: z.string(),
  linkedinUrl: z.url(),
  publishedAt: z.coerce.date(),
  tags: z.array(z.string()).default([]),
  title: z.string(),
});

export type Article = CollectionEntry<"articles">;

/** An article with a page of its own, whose body is its Markdown. */
export type ArticleWithPage = Article & { readonly body: string };

// A common estimate of an adult's silent reading pace.
const WORDS_READ_PER_MINUTE = 200;

export function newestFirst(articles: readonly Article[]): Article[] {
  return articles.toSorted(
    (first, second) =>
      second.data.publishedAt.getTime() - first.data.publishedAt.getTime(),
  );
}

export function articleHref(article: Article): string {
  return hasPage(article)
    ? `/articles/${article.id}/`
    : article.data.linkedinUrl;
}

export function hasPage(article: Article): article is ArticleWithPage {
  return article.body !== undefined && article.body.trim() !== "";
}

export function formatPublishedDate(article: Article): string {
  // YAML reads a front matter date as its midnight in UTC.
  return LONG_DATE.format(article.data.publishedAt);
}

export function readingMinutes(article: ArticleWithPage): number {
  const words = article.body.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / WORDS_READ_PER_MINUTE));
}
