/**
 * @file `/rss.xml`: the writing feed, with an item for each article that has a
 * page here, newest first.
 */

import type { APIRoute } from "astro";

import rss from "@astrojs/rss";

import { SITE_URL } from "../site.ts";
import { articleHref, hasPage } from "../writing/articles/article.ts";
import { loadArticles } from "../writing/articles/collection.ts";
import { WRITING } from "../writing/writing.ts";

export const GET: APIRoute = async () => {
  const articles = (await loadArticles()).filter(hasPage);
  return rss({
    description: WRITING.description,
    items: articles.map((article) => ({
      categories: [...article.data.tags],
      description: article.data.description,
      link: articleHref(article),
      pubDate: article.data.publishedAt,
      title: article.data.title,
    })),
    site: SITE_URL,
    title: WRITING.feedTitle,
  });
};
