import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { SITE_URL } from '@config';

export async function GET(context: APIContext) {
  const site = context.site ?? new URL(SITE_URL);

  const [articles, posts] = await Promise.all([
    getCollection('articles'),
    getCollection('blog', ({ data }) => !data.draft),
  ]);

  const items = [
    ...articles.map((entry) => ({
      title: entry.data.title,
      description: entry.data.description,
      pubDate: entry.data.publishedAt,
      link: `/articles/${entry.id}/`,
      categories: entry.data.tags,
    })),
    ...posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.publishedAt,
      link: `/blog/${post.id}/`,
      categories: post.data.tags,
    })),
  ].sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf());

  return rss({
    title: 'Tomer Nosrati (Nusnus) — Writing',
    description:
      'Thoughts on distributed systems, open source leadership, and software engineering philosophy.',
    site,
    items,
  });
}
