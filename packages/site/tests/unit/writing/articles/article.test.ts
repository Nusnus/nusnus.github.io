/**
 * @file An article: its front matter parses to the fields the site shows;
 * articles order newest first; one with a body has its own page, which links to
 * it go to, while one without goes to LinkedIn; its date reads the same in
 * every time zone; and its reading time rounds to whole minutes, never under
 * one.
 */

import { describe, expect, it, vi } from "vitest";

import {
  type Article,
  articleHref,
  formatPublishedDate,
  frontMatterSchema,
  hasPage,
  newestFirst,
  readingMinutes,
} from "../../../../src/writing/articles/article.ts";
import {
  LINKEDIN_ONLY,
  NEWER_WITH_PAGE,
  OLDER_WITH_PAGE,
} from "../../../fixtures/articles.ts";

const FRONT_MATTER = {
  description: "On end-to-end thinking.",
  linkedinUrl: "https://www.linkedin.com/pulse/elevate/",
  publishedAt: new Date("2023-08-26T00:00:00.000Z"),
  title: "Elevate Your Game with E2E Thinking",
};

function withBody(body: string): Article {
  return { ...OLDER_WITH_PAGE, body };
}

function wordsAmidMixedWhiteSpace(count: number): string {
  return Array.from({ length: count }, () => "word").join(" \n\t ");
}

describe("frontMatterSchema", () => {
  it("parses front matter with tags as given", () => {
    expect(
      frontMatterSchema.parse({ ...FRONT_MATTER, tags: ["leadership"] }),
    ).toStrictEqual({ ...FRONT_MATTER, tags: ["leadership"] });
  });

  it("gives an article without tags none", () => {
    expect(frontMatterSchema.parse(FRONT_MATTER).tags).toStrictEqual([]);
  });

  it("reads a date written as text", () => {
    expect(
      frontMatterSchema.parse({ ...FRONT_MATTER, publishedAt: "2023-08-26" })
        .publishedAt,
    ).toStrictEqual(new Date("2023-08-26T00:00:00.000Z"));
  });

  it("refuses a LinkedIn link that is not a URL", () => {
    expect(
      frontMatterSchema
        .safeParse({ ...FRONT_MATTER, linkedinUrl: "elevate" })
        .error?.issues.map(({ code, path }) => [path, code]),
    ).toStrictEqual([[["linkedinUrl"], "invalid_format"]]);
  });
});

describe("newestFirst", () => {
  it("orders articles by publication date, latest first", () => {
    expect(
      newestFirst([OLDER_WITH_PAGE, LINKEDIN_ONLY, NEWER_WITH_PAGE]),
    ).toStrictEqual([LINKEDIN_ONLY, NEWER_WITH_PAGE, OLDER_WITH_PAGE]);
  });
});

describe("articleHref", () => {
  it("links an article with a body to its own page", () => {
    expect(articleHref(OLDER_WITH_PAGE)).toBe(
      "/articles/elevate-your-game-e2e-thinking/",
    );
  });

  it("links an article without a body to LinkedIn", () => {
    expect(articleHref(LINKEDIN_ONLY)).toBe(
      "https://www.linkedin.com/pulse/celery-now-powered-blacksmith-tomer-nosrati-ew68e",
    );
  });
});

describe("hasPage", () => {
  it("holds for an article whose body has text", () => {
    expect(hasPage(withBody("\nText.\n"))).toBe(true);
  });

  it("does not hold for an article whose body is white space only", () => {
    expect(hasPage(withBody(" \n"))).toBe(false);
  });

  it("does not hold for an article with no body", () => {
    const { collection, data, id } = OLDER_WITH_PAGE;

    expect(hasPage({ collection, data, id })).toBe(false);
  });
});

describe("formatPublishedDate", () => {
  it("spells out the front matter's calendar date, even west of UTC", () => {
    vi.stubEnv("TZ", "America/Los_Angeles");

    expect(formatPublishedDate(NEWER_WITH_PAGE)).toBe("September 9, 2023");
  });
});

describe("readingMinutes", () => {
  it("counts a short article as one minute", () => {
    expect(readingMinutes({ ...OLDER_WITH_PAGE, body: "word" })).toBe(1);
  });

  it("rounds 299 words at 200 a minute down to one minute, ignoring white space around and between them", () => {
    expect(
      readingMinutes({
        ...OLDER_WITH_PAGE,
        body: `\n ${wordsAmidMixedWhiteSpace(299)} \n`,
      }),
    ).toBe(1);
  });

  it("rounds 300 words at 200 a minute up to two minutes", () => {
    expect(
      readingMinutes({
        ...OLDER_WITH_PAGE,
        body: wordsAmidMixedWhiteSpace(300),
      }),
    ).toBe(2);
  });
});
