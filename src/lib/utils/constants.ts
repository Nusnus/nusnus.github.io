export const GITHUB_USERNAME = 'Nusnus';

export const SITE_URL = 'https://nusnus.github.io';

export const OPEN_COLLECTIVE_URL = 'https://opencollective.com/celery';

export const CELERY_REPOS = [
  'celery/celery',
  'celery/pytest-celery',
  'celery/kombu',
  'celery/billiard',
  'mher/flower',
] as const;

export const REPO_ROLES: Record<string, 'owner' | 'lead' | 'creator' | 'contributor'> = {
  'celery/celery': 'owner',
  'celery/pytest-celery': 'creator',
  'celery/kombu': 'owner',
  'celery/billiard': 'owner',
  'mher/flower': 'contributor',
};

export const SOCIAL_LINKS = {
  github: 'https://github.com/Nusnus',
  linkedin: 'https://www.linkedin.com/in/tomer-nosrati',
  twitter: 'https://x.com/smilingnosrati',
  email: 'mailto:tomer.nosrati@gmail.com',
  openCollective: OPEN_COLLECTIVE_URL,
} as const;

export const LINKEDIN_ARTICLES = [
  {
    title: 'Elevate Your Game with E2E Thinking',
    url: 'https://www.linkedin.com/pulse/elevate-your-game-e2e-thinking-tomer-nosrati-yzaff/',
    excerpt:
      'A methodology for thinking about systems holistically — from input to output, from user to infrastructure.',
    publishedAt: '2024-06-01',
  },
  {
    title: 'The Subtle Art of Making Every Word Count',
    url: 'https://www.linkedin.com/pulse/subtle-art-making-every-word-count-tomer-nosrati-yzaff/',
    excerpt:
      'How precision in communication transforms engineering teams and open source collaboration.',
    publishedAt: '2024-05-01',
  },
] as const;

export const COLLABORATIONS = [
  {
    name: 'Cognition AI',
    title: 'SWE-1.6 Extra Credit Recognition',
    description: 'Recognized for contributions to Celery data and tooling for SWE-1.6 evaluation.',
    url: 'https://cognition.ai',
  },
  {
    name: 'Blacksmith',
    title: 'Celery: Now Powered By Blacksmith',
    description:
      'Celery CI/CD infrastructure powered by Blacksmith for faster, more reliable builds.',
    url: 'https://useblacksmith.com',
  },
  {
    name: 'Devin AI',
    title: 'Celery DeepWiki',
    description:
      'Comprehensive AI-generated documentation and knowledge base for the Celery ecosystem.',
    url: 'https://deepwiki.com/celery/celery',
  },
] as const;
