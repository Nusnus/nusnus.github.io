/**
 * @file A fake of Astro's `astro:content` module, which only Astro's build
 * resolves, so Vitest serves this in its place: `getCollection` hands over the
 * articles fixture's articles, in no date order, and no entries for any other
 * collection, as Astro does for a collection it does not define; and
 * `defineCollection` gives back the collection's config, as Astro's does for a
 * collection with a loader.
 */

import type { Article } from "../../src/writing/articles/article.ts";

import { LINKEDIN_ONLY, NEWER_WITH_PAGE, OLDER_WITH_PAGE } from "./articles.ts";

export function getCollection(collection: string): Promise<Article[]> {
  return Promise.resolve(
    collection === "articles"
      ? [OLDER_WITH_PAGE, LINKEDIN_ONLY, NEWER_WITH_PAGE]
      : [],
  );
}

export function defineCollection<Config>(config: Config): Config {
  return config;
}
