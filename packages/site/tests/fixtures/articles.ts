/**
 * @file Articles shaped as Astro's `articles` collection hands them over, from
 * the site's own Markdown files, with their bodies cut short: two with a page
 * of their own, one linked on LinkedIn, and in no date order.
 */

import type { Article } from "../../src/writing/articles/article.ts";

// Only the site's Astro components, which neither coverage nor mutation
// testing measures, read an article's collection, a LinkedIn-only article's
// id, title, description and tags, and the LinkedIn URL of an article with a
// page of its own. The unit tests only carry those values along, so none can
// tell them from others, and each is exempt on its own line.

export const LINKEDIN_ONLY: Article = {
  body: "",
  // Stryker disable next-line StringLiteral
  collection: "articles",
  data: {
    description:
      // Stryker disable next-line StringLiteral
      "Announcing an exciting partnership for the Celery organization with Blacksmith for faster, more reliable CI/CD builds.",
    linkedinUrl:
      "https://www.linkedin.com/pulse/celery-now-powered-blacksmith-tomer-nosrati-ew68e",
    publishedAt: new Date("2024-10-15T00:00:00.000Z"),
    // Stryker disable next-line ArrayDeclaration
    tags: [],
    // Stryker disable next-line StringLiteral
    title: "Celery: Now Powered By Blacksmith",
  },
  // Stryker disable next-line StringLiteral
  id: "celery-now-powered-by-blacksmith",
};

export const OLDER_WITH_PAGE: Article = {
  body: "\n## The True Essence of Task Completion\n\nEnd-to-end work isn't just about ticking off boxes on a checklist.\n",
  // Stryker disable next-line StringLiteral
  collection: "articles",
  data: {
    description:
      "Taking an end-to-end approach is more than just a professional technique; it's a lifestyle philosophy.",
    linkedinUrl:
      // Stryker disable next-line StringLiteral
      "https://www.linkedin.com/pulse/elevate-your-game-e2e-thinking-tomer-nosrati/",
    publishedAt: new Date("2023-08-26T00:00:00.000Z"),
    tags: ["leadership", "philosophy", "software engineering"],
    title: "Elevate Your Game with E2E Thinking",
  },
  id: "elevate-your-game-e2e-thinking",
};

export const NEWER_WITH_PAGE: Article = {
  body: "\nEver felt trapped in a never-ending monologue, waiting for the point that never comes?\n",
  // Stryker disable next-line StringLiteral
  collection: "articles",
  data: {
    description:
      "The Point-First Approach (PFA) — your escape hatch from verbosity and your gateway to focused, meaningful conversations.",
    linkedinUrl:
      // Stryker disable next-line StringLiteral
      "https://www.linkedin.com/pulse/subtle-art-making-every-word-count-tomer-nosrati/",
    publishedAt: new Date("2023-09-09T00:00:00.000Z"),
    tags: ["communication", "philosophy", "productivity"],
    title: "The Subtle Art of Making Every Word Count",
  },
  id: "subtle-art-making-every-word-count",
};
