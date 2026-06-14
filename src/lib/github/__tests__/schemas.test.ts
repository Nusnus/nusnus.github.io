import { describe, it, expect } from 'vitest';
import {
  profileSchema,
  repoSchema,
  reposSchema,
  contributionGraphSchema,
} from '@lib/github/schemas';

const validProfile = {
  login: 'Nusnus',
  name: 'Tomer Nosrati',
  bio: 'Artist who codes.',
  avatarUrl: 'https://avatars.githubusercontent.com/u/4662342?v=4',
  htmlUrl: 'https://github.com/Nusnus',
  followers: 115,
  publicRepos: 19,
};

const validRepo = {
  name: 'celery',
  fullName: 'celery/celery',
  description: 'Distributed task queue',
  htmlUrl: 'https://github.com/celery/celery',
  stars: 28584,
  forks: 4800,
  openIssues: 700,
  lastPush: '2026-06-01T12:00:00Z',
  language: 'Python',
  role: 'owner' as const,
  contributorRank: 4,
};

describe('profileSchema', () => {
  it('accepts a well-formed profile', () => {
    expect(profileSchema.safeParse(validProfile).success).toBe(true);
  });

  it('rejects a non-URL avatar', () => {
    expect(profileSchema.safeParse({ ...validProfile, avatarUrl: 'not-a-url' }).success).toBe(
      false,
    );
  });

  it('rejects negative follower counts', () => {
    expect(profileSchema.safeParse({ ...validProfile, followers: -1 }).success).toBe(false);
  });
});

describe('repoSchema', () => {
  it('accepts a well-formed repo and an array of repos', () => {
    expect(repoSchema.safeParse(validRepo).success).toBe(true);
    expect(
      reposSchema.safeParse([validRepo, { ...validRepo, contributorRank: undefined }]).success,
    ).toBe(true);
  });

  it('allows a null language', () => {
    expect(repoSchema.safeParse({ ...validRepo, language: null }).success).toBe(true);
  });

  it('rejects an unknown role', () => {
    expect(repoSchema.safeParse({ ...validRepo, role: 'maintainer' }).success).toBe(false);
  });
});

describe('contributionGraphSchema', () => {
  it('accepts a minimal valid graph', () => {
    const graph = {
      totalContributions: 4197,
      totalCommits: 357,
      totalPRs: 111,
      totalReviews: 102,
      totalIssues: 12,
      weeks: [
        {
          contributionDays: [{ date: '2026-01-01', contributionCount: 5, weekday: 3 }],
        },
      ],
    };
    expect(contributionGraphSchema.safeParse(graph).success).toBe(true);
  });

  it('rejects an out-of-range weekday', () => {
    const graph = {
      totalContributions: 0,
      totalCommits: 0,
      totalPRs: 0,
      totalReviews: 0,
      totalIssues: 0,
      weeks: [{ contributionDays: [{ date: '2026-01-01', contributionCount: 0, weekday: 9 }] }],
    };
    expect(contributionGraphSchema.safeParse(graph).success).toBe(false);
  });
});
