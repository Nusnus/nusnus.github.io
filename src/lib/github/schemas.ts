import { z } from 'zod/v4';

// ─── Profile Data Schema ───

export const profileSchema = z.object({
  login: z.string(),
  name: z.string(),
  bio: z.string(),
  avatarUrl: z.string().url(),
  htmlUrl: z.string().url(),
  followers: z.number().int().nonnegative(),
  publicRepos: z.number().int().nonnegative(),
});

// ─── Repo Data Schema ───

export const repoSchema = z.object({
  name: z.string(),
  fullName: z.string(),
  description: z.string(),
  htmlUrl: z.string().url(),
  stars: z.number().int().nonnegative(),
  forks: z.number().int().nonnegative(),
  openIssues: z.number().int().nonnegative(),
  lastPush: z.string().datetime(),
  language: z.string().nullable(),
  role: z.enum(['owner', 'lead', 'creator', 'contributor']),
  contributorRank: z.number().int().positive().optional(),
});

export const reposSchema = z.array(repoSchema);

// ─── Activity Event Schema ───

export const activityEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  repo: z.string(),
  title: z.string(),
  url: z.string().url(),
  createdAt: z.string().datetime(),
});

export const activitySchema = z.object({
  events: z.array(activityEventSchema),
  todaySummary: z.object({
    commits: z.number().int().nonnegative(),
    prsOpened: z.number().int().nonnegative(),
    prsReviewed: z.number().int().nonnegative(),
    issueComments: z.number().int().nonnegative(),
  }),
});

// ─── Contribution Graph Schema ───

export const contributionDaySchema = z.object({
  date: z.string(),
  contributionCount: z.number().int().nonnegative(),
  weekday: z.number().int().min(0).max(6),
});

export const contributionWeekSchema = z.object({
  contributionDays: z.array(contributionDaySchema),
});

export const contributionGraphSchema = z.object({
  totalContributions: z.number().int().nonnegative(),
  totalCommits: z.number().int().nonnegative(),
  totalPRs: z.number().int().nonnegative(),
  totalReviews: z.number().int().nonnegative(),
  totalIssues: z.number().int().nonnegative(),
  weeks: z.array(contributionWeekSchema),
});

// ─── Meta Schema ───

export const metaSchema = z.object({
  lastUpdated: z.string().datetime(),
  status: z.array(z.enum(['fulfilled', 'rejected'])),
});
