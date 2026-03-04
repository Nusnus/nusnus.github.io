/**
 * Static content data — articles, collaborations.
 *
 * Single source of truth for content displayed in sections
 * and fed into AI context builders.
 */

export interface Article {
  title: string;
  url: string;
  excerpt: string;
  publishedAt: string;
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
  },
  {
    title: 'The Subtle Art of Making Every Word Count',
    url: 'https://www.linkedin.com/pulse/subtle-art-making-every-word-count-tomer-nosrati',
    excerpt:
      'The Point-First Approach (PFA) — your escape hatch from verbosity and your gateway to focused, meaningful conversations.',
    publishedAt: '2023-09-09',
  },
] as const;

export const COLLABORATIONS: readonly Collaboration[] = [
  {
    name: 'Cognition AI',
    title: 'SWE-1.6 Extra Credit Recognition',
    description: 'Recognized for contributions to Celery data and tooling for SWE-1.6 evaluation.',
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
