/**
 * @file Each page's metadata: a title that ends in the site's name, or on the
 * home page starts with it, a canonical URL on its own path except for a page
 * with no URL of its own, and structured data that describes the person, plus
 * the article on an article's page.
 */

import { describe, expect, it } from "vitest";

import {
  type PageFacts,
  pageMetadata,
} from "../../../src/layouts/page-metadata.ts";

const HOME: PageFacts = {
  canonicalPath: "/",
  description: "The home page.",
};

const PERSON_STRUCTURED_DATA = {
  "@type": "Person",
  alternateName: "Nusnus",
  description:
    "Software engineer and open source leader. Creator of pytest-celery, top contributor to Celery.",
  image: "https://avatars.githubusercontent.com/u/4662342?v=4",
  jobTitle: "CEO & Tech Lead, Celery Organization",
  knowsAbout: [
    "Distributed Systems",
    "Open Source",
    "Python",
    "Celery",
    "Software Testing",
    "End-to-End Testing",
  ],
  name: "Tomer Nosrati",
  sameAs: [
    "https://github.com/Nusnus",
    "https://www.linkedin.com/in/tomernosrati",
    "https://x.com/smilingnosrati",
  ],
  url: "https://nusnus.github.io/",
};

describe("pageMetadata", () => {
  it("describes the person, as a website at the page's own URL", () => {
    const metadata = pageMetadata(HOME);

    expect({
      ...metadata,
      structuredDataJson: JSON.parse(metadata.structuredDataJson) as unknown,
    }).toStrictEqual({
      canonicalUrl: "https://nusnus.github.io/",
      imageUrl: "https://nusnus.github.io/og/default.png",
      openGraphType: "website",
      structuredDataJson: {
        "@context": "https://schema.org",
        ...PERSON_STRUCTURED_DATA,
      },
      title: "Tomer Nosrati (Nusnus) — CEO & Tech Lead, Celery Organization",
    });
  });

  it("names a page with a name of its own before the site's name", () => {
    expect(pageMetadata({ ...HOME, pageName: "Writing" }).title).toBe(
      "Writing — Tomer Nosrati (Nusnus)",
    );
  });

  it("describes an article, written by the person and headed by its name, on an article's page", () => {
    const metadata = pageMetadata({
      article: {
        publishedAt: new Date("2023-09-09T00:00:00Z"),
        tags: ["Testing", "Craft"],
      },
      canonicalPath: "/articles/elevate/",
      description: "On end-to-end thinking.",
      pageName: "Elevate your game",
    });

    expect({
      ...metadata,
      structuredDataJson: JSON.parse(metadata.structuredDataJson) as unknown,
    }).toStrictEqual({
      canonicalUrl: "https://nusnus.github.io/articles/elevate/",
      imageUrl: "https://nusnus.github.io/og/default.png",
      openGraphType: "article",
      structuredDataJson: {
        "@context": "https://schema.org",
        "@type": "Article",
        author: PERSON_STRUCTURED_DATA,
        datePublished: "2023-09-09T00:00:00.000Z",
        description: "On end-to-end thinking.",
        headline: "Elevate your game",
        image: "https://nusnus.github.io/og/default.png",
        keywords: ["Testing", "Craft"],
        url: "https://nusnus.github.io/articles/elevate/",
      },
      title: "Elevate your game — Tomer Nosrati (Nusnus)",
    });
  });

  it("gives a page with no URL of its own no canonical URL", () => {
    expect(
      pageMetadata({ description: "Not found.", pageName: "Page not found" })
        .canonicalUrl,
    ).toBeUndefined();
  });

  it("escapes `<` in the structured data, so no string can end its script element", () => {
    const { structuredDataJson } = pageMetadata({
      ...HOME,
      article: { publishedAt: new Date(0), tags: [] },
      pageName: "</script>",
    });

    expect(structuredDataJson).toContain(
      String.raw`"headline":"\u003c/script>"`,
    );
    expect(structuredDataJson).not.toContain("</script>");
  });
});
