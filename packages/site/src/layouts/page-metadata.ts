/**
 * @file A page's metadata for search engines, browsers and link previews: its
 * title, which ends in the site's name, its canonical URL, its Open Graph type
 * and image, and its schema.org structured data, which describes the person on
 * every page and, on an article's page, the article too.
 */

import { PERSON } from "../person.ts";
import { SITE_NAME, SITE_URL } from "../site.ts";

/** What an article's page tells search engines beyond its name. */
interface ArticleFacts {
  readonly publishedAt: Date;
  readonly tags: readonly string[];
}

/**
 * How a page names itself: by its own name, such as "Writing", which the home
 * page lacks, or on an article's page by the article's title, beside the
 * article's facts.
 */
export type PageNaming =
  | { readonly article: ArticleFacts; readonly pageName: string }
  | { readonly article?: undefined; readonly pageName?: string | undefined };

/**
 * What a page knows about itself: how it names itself; its description; and
 * the path of its own URL, which a page served at URLs not its own, such as
 * the 404 page, lacks.
 */
export type PageFacts = PageNaming & {
  readonly canonicalPath?: string | undefined;
  readonly description: string;
};

/**
 * A page's metadata, its structured data as JSON that is safe inside a
 * <script> element.
 */
export interface PageMetadata {
  readonly canonicalUrl: string | undefined;
  readonly imageUrl: string;
  readonly openGraphType: "article" | "website";
  readonly structuredDataJson: string;
  readonly title: string;
}

const IMAGE_PATH = "/og/default.png";

export function pageMetadata(page: PageFacts): PageMetadata {
  const canonicalUrl =
    page.canonicalPath === undefined
      ? undefined
      : new URL(page.canonicalPath, SITE_URL).href;
  const imageUrl = new URL(IMAGE_PATH, SITE_URL).href;
  const structuredData = {
    "@context": "https://schema.org",
    ...(page.article === undefined
      ? personStructuredData()
      : {
          "@type": "Article",
          author: personStructuredData(),
          datePublished: page.article.publishedAt.toISOString(),
          description: page.description,
          headline: page.pageName,
          image: imageUrl,
          keywords: page.article.tags,
          url: canonicalUrl,
        }),
  };
  return {
    canonicalUrl,
    imageUrl,
    openGraphType: page.article === undefined ? "website" : "article",
    // Escaping `<` keeps a `</script>` inside any string from ending the
    // element early.
    structuredDataJson: JSON.stringify(structuredData).replaceAll(
      "<",
      String.raw`\u003c`,
    ),
    title:
      page.pageName === undefined
        ? `${SITE_NAME} — ${PERSON.jobTitle}`
        : `${page.pageName} — ${SITE_NAME}`,
  };
}

function personStructuredData(): Record<string, unknown> {
  return {
    "@type": "Person",
    alternateName: PERSON.githubLogin,
    description: PERSON.description,
    image: PERSON.staticAvatarUrl,
    jobTitle: PERSON.jobTitle,
    knowsAbout: PERSON.knowsAbout,
    name: PERSON.name,
    sameAs: [PERSON.githubUrl, PERSON.linkedinUrl, PERSON.xUrl],
    url: SITE_URL.href,
  };
}
