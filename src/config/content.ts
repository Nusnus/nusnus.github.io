/**
 * Static content data — articles, collaborations.
 *
 * Single source of truth for content displayed in the
 * Writing and Collaborations sections.
 */

export interface Article {
  title: string;
  url: string;
  excerpt: string;
  publishedAt: string;
  /** Slug for the native article page. When set, card links to /articles/<slug>. */
  slug?: string;
}

export interface Collaboration {
  name: string;
  title: string;
  description: string;
  url: string;
  xUrl?: string;
}

export const LINKEDIN_ARTICLES: readonly Article[] = [
  {
    title: 'Celery: Now Powered By Blacksmith',
    url: 'https://www.linkedin.com/pulse/celery-now-powered-blacksmith-tomer-nosrati-ew68e',
    excerpt:
      'Announcing an exciting partnership for the Celery organization with Blacksmith for faster, more reliable CI/CD builds.',
    publishedAt: '2024-10-15',
  },
  {
    title: 'Elevate Your Game with E2E Thinking',
    url: 'https://www.linkedin.com/pulse/elevate-your-game-e2e-thinking-tomer-nosrati',
    excerpt:
      "Taking an end-to-end approach is more than just a professional technique; it's a lifestyle philosophy.",
    publishedAt: '2023-08-26',
    slug: 'elevate-your-game-e2e-thinking',
  },
  {
    title: 'The Subtle Art of Making Every Word Count',
    url: 'https://www.linkedin.com/pulse/subtle-art-making-every-word-count-tomer-nosrati',
    excerpt:
      'The Point-First Approach (PFA) — your escape hatch from verbosity and your gateway to focused, meaningful conversations.',
    publishedAt: '2023-09-09',
    slug: 'subtle-art-making-every-word-count',
  },
] as const;

export const COLLABORATIONS: readonly Collaboration[] = [
  {
    name: 'Cognition AI',
    title: 'FrontierCode Benchmark',
    description:
      "One of 20+ open-source maintainers who built FrontierCode, Cognition's benchmark for code mergeability, crafting eval tasks from the repos they maintain. \u201CWhere others grade like a CI, FrontierCode grades like a tech lead.\u201D",
    url: 'https://cognition.ai/blog/frontier-code',
    xUrl: 'https://x.com/cognition/status/2064061031912288715',
  },
  {
    name: 'Cognition AI',
    title: 'SWE-1.6 Extra Credit',
    description:
      'Highlighted for outsized contributions to data & tooling as a member of the contractor team.',
    url: 'https://cognition.ai/blog/swe-1-6-preview',
  },
  {
    name: 'Blacksmith',
    title: 'Celery: Now Powered By Blacksmith',
    description:
      'Celery CI/CD infrastructure powered by Blacksmith for faster, more reliable builds.',
    url: 'https://www.blacksmith.sh/customer-stories/celery',
  },
  {
    name: 'Devin AI',
    title: 'Celery DeepWiki',
    description:
      'Comprehensive AI-generated documentation and knowledge base for the Celery ecosystem.',
    url: 'https://deepwiki.com/celery/celery',
    xUrl: 'https://x.com/smilingnosrati/status/1920104278116696513',
  },
] as const;
