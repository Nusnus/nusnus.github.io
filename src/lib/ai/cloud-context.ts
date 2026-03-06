/**
 * Cloud context builder — feeds ALL available data to cloud models.
 *
 * Unlike the RAG approach (designed for 4K context WebLLM models), cloud
 * models like Grok have massive context windows (2M tokens). We dump
 * everything — no chunking, no BM25 search, no retrieval failures.
 *
 * Data is fetched from the Cloudflare Worker (live, edge-cached) with
 * automatic fallback to build-time static JSON if the Worker is unavailable.
 *
 * Comprehensive data sources included:
 * - Persona & knowledge base (markdown files)
 * - Live GitHub data (profile, repos, activity, contributions)
 * - Site metadata (URL, username, navigation structure)
 * - Repository configuration (featured repos, org repos, roles)
 * - LinkedIn articles & blog posts
 * - Collaborations & partnerships
 * - Social links
 *
 * Total context: ~15K tokens — trivial for a 2M context model.
 */

import type { ActivityData, RepoData, ContributionGraphData, ProfileData } from '@lib/github/types';
import {
  LINKEDIN_ARTICLES,
  COLLABORATIONS,
  SOCIAL_LINKS,
  NAV_LINKS,
  SITE_URL,
  GITHUB_USERNAME,
  CELERY_REPOS,
  CELERY_ORG_REPOS,
  REPO_ROLES,
  safeRepoName,
  WORKER_BASE_URL,
} from '@config';
import { relativeTime } from '@lib/utils/date';
import { buildPersonalityInstruction } from './personality';

/** Format a number with commas (full precision for AI context). */
const fmt = (n: number) => n.toLocaleString('en-US');

/** Format an ISO date as relative time. */
const formatRelative = relativeTime;

/**
 * Fetch a GitHub endpoint from the Worker (live, cached), falling back to
 * the static JSON file baked in at build time.
 */
async function fetchGitHub(workerPath: string, staticPath: string): Promise<Response | null> {
  try {
    const res = await fetch(`${WORKER_BASE_URL}/github/${workerPath}`);
    if (res.ok) return res;
  } catch {
    /* network error — fall through to static */
  }
  try {
    const res = await fetch(staticPath);
    if (res.ok) return res;
  } catch {
    /* ignore */
  }
  return null;
}

/*
 * ── AI Context Files ──
 *
 * Persona and knowledge are loaded from markdown files in /data/ai-context/.
 * This makes them easy to edit, preview, and test without touching TypeScript.
 *
 * Files:
 *   /data/ai-context/persona.md   — Grok personality, tone, formatting rules
 *   /data/ai-context/knowledge.md — Facts about Tomer, Celery, projects, etc.
 */

/** Fetch a markdown context file, returning its text or empty string. */
async function fetchContextFile(path: string): Promise<string> {
  try {
    const res = await fetch(path);
    if (res.ok) return await res.text();
  } catch {
    /* unavailable — skip */
  }
  return '';
}

/**
 * Fetch ALL data sources and build a comprehensive context string.
 * Tries the live Worker endpoints first (cached at edge), falls back to
 * build-time static JSON if the Worker is unavailable.
 *
 * @param additionalContext Optional situational context appended at the end
 *   (e.g. roast widget tells Grok it's running on the homepage while the
 *   visitor is watching the portfolio).
 * @param personalityLevel Optional personality level (0-4) for tone control
 */
export async function buildCloudContext(
  additionalContext?: string,
  personalityLevel?: number,
): Promise<string> {
  const sections: string[] = [];

  // Add personality instruction if provided
  if (personalityLevel !== undefined) {
    sections.push(buildPersonalityInstruction(personalityLevel));
  }

  // Fetch all data sources in parallel — context files + Worker data (static fallback)
  const [persona, knowledge, profileRes, reposRes, orgReposRes, activityRes, graphRes] =
    await Promise.all([
      fetchContextFile('/data/ai-context/persona.md'),
      fetchContextFile('/data/ai-context/knowledge.md'),
      fetchGitHub('profile', '/data/profile.json'),
      fetchGitHub('repos', '/data/repos.json'),
      fetchGitHub('org-repos', '/data/celery-org-repos.json'),
      fetchGitHub('activity', '/data/activity.json'),
      fetchGitHub('contributions', '/data/contribution-graph.json'),
    ]);

  // ── Persona (Grok personality) — must come first ──
  if (persona) sections.push(persona);

  // ── Knowledge base (facts about Tomer, projects, etc.) ──
  if (knowledge) sections.push(knowledge);

  // ── GitHub profile ──
  if (profileRes?.ok) {
    const profile = (await profileRes.json()) as ProfileData;
    sections.push(
      `# Live GitHub Profile\n` +
        `- **${profile.name}** (@${profile.login})\n` +
        `- Bio: ${profile.bio}\n` +
        `- Followers: ${fmt(profile.followers)} · Public repos: ${profile.publicRepos}`,
    );
  }

  // ── Featured projects (full details) ──
  if (reposRes?.ok) {
    const repos = (await reposRes.json()) as RepoData[];
    const lines = repos.map((r) => {
      const rank = r.contributorRank ? ` · #${r.contributorRank} all-time contributor` : '';
      return (
        `- **${r.fullName}**: ${r.description}\n` +
        `  ${fmt(r.stars)}★ · ${fmt(r.forks)} forks · ${r.openIssues} open issues · ` +
        `Role: ${r.role}${rank} · Language: ${r.language ?? 'Python'} · Last push: ${formatRelative(r.lastPush)}`
      );
    });
    sections.push(`# Featured Projects (Live Data)\n${lines.join('\n')}`);
  }

  // ── Celery org repos (full details) ──
  if (orgReposRes?.ok) {
    const orgRepos = (await orgReposRes.json()) as RepoData[];
    const lines = orgRepos.map((r) => {
      const rank = r.contributorRank ? ` · #${r.contributorRank} all-time contributor` : '';
      return `- **${r.fullName}**: ${r.description} · ${fmt(r.stars)}★ · Role: ${r.role}${rank}`;
    });
    sections.push(`# Celery Organization Repos (Live Data)\n${lines.join('\n')}`);
  }

  // ── Contribution stats ──
  if (graphRes?.ok) {
    const graph = (await graphRes.json()) as ContributionGraphData;
    sections.push(
      `# Contribution Stats (Last 12 Months)\n` +
        `- Total contributions: ${fmt(graph.totalContributions)}\n` +
        `- Commits: ${fmt(graph.totalCommits)}\n` +
        `- Pull requests: ${fmt(graph.totalPRs)}\n` +
        `- Code reviews: ${fmt(graph.totalReviews)}\n` +
        `- Issues: ${fmt(graph.totalIssues)}`,
    );
  }

  // ── Recent activity (ALL events, not just 5) — redact private repos ──
  if (activityRes?.ok) {
    const data = (await activityRes.json()) as ActivityData;

    if (data.events.length > 0) {
      const lines = data.events.map((e) => {
        const repo = safeRepoName(e.repo);
        return `- [${formatRelative(e.createdAt)}] ${e.type}: ${e.title} (${repo})`;
      });
      sections.push(`# Recent GitHub Activity (Live)\n${lines.join('\n')}`);
    }

    const s = data.todaySummary;
    const todayParts: string[] = [];
    if (s.commits) todayParts.push(`${s.commits} commits`);
    if (s.prsOpened) todayParts.push(`${s.prsOpened} PRs opened`);
    if (s.prsReviewed) todayParts.push(`${s.prsReviewed} PRs reviewed`);
    if (s.issueComments) todayParts.push(`${s.issueComments} issue comments`);
    if (todayParts.length > 0) {
      sections.push(`# Today's Activity Summary\n${todayParts.join(' · ')}`);
    }
  }

  // ── Static site content (hardcoded in constants.ts, not fetched from API) ──

  // Site metadata
  sections.push(
    `# Website Information\n` +
      `- **Site URL**: ${SITE_URL}\n` +
      `- **GitHub Username**: ${GITHUB_USERNAME}\n` +
      `- **Navigation Sections**: ${NAV_LINKS.map((link) => link.label).join(', ')}`,
  );

  // Repository configuration
  const featuredReposList = CELERY_REPOS.map(
    (repo) => `${repo} (${REPO_ROLES[repo] ?? 'contributor'})`,
  ).join(', ');
  const orgReposList = CELERY_ORG_REPOS.map(
    (repo) => `${repo} (${REPO_ROLES[repo] ?? 'contributor'})`,
  ).join(', ');
  sections.push(
    `# Repository Configuration\n` +
      `- **Featured Celery Repos**: ${featuredReposList}\n` +
      `- **Celery Organization Repos**: ${orgReposList}`,
  );

  // LinkedIn articles
  const articleLines = LINKEDIN_ARTICLES.map(
    (a) => `- **${a.title}** (${a.publishedAt})\n  ${a.excerpt}\n  URL: ${a.url}`,
  );
  sections.push(`# Articles & Writing (Published on LinkedIn)\n${articleLines.join('\n')}`);

  // Blog posts (if any exist) — only available server-side
  // Skip on client-side (import will fail)
  if (typeof window === 'undefined') {
    try {
      // Use Function constructor to hide import from Vite's static analysis
      const getCollection = (await new Function('return import("astro:content")')()).getCollection;

      // Type for blog post entries
      interface BlogPost {
        id: string;
        data: {
          title: string;
          description: string;
          publishedAt: Date;
          tags: string[];
          draft: boolean;
          crossPostedTo?: string[];
        };
      }

      const blogPosts = (await getCollection('blog')) as BlogPost[];
      const publishedPosts = blogPosts.filter((post) => !post.data.draft);
      if (publishedPosts.length > 0) {
        const blogLines = publishedPosts
          .sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime())
          .map((post) => {
            const tags = post.data.tags.length > 0 ? ` · Tags: ${post.data.tags.join(', ')}` : '';
            const crossPosted =
              post.data.crossPostedTo && post.data.crossPostedTo.length > 0
                ? ` · Cross-posted to: ${post.data.crossPostedTo.join(', ')}`
                : '';
            return (
              `- **${post.data.title}** (${post.data.publishedAt.toISOString().split('T')[0]})\n` +
              `  ${post.data.description}${tags}${crossPosted}\n` +
              `  URL: ${SITE_URL}/blog/${post.id}`
            );
          });
        sections.push(`# Blog Posts\n${blogLines.join('\n')}`);
      }
    } catch {
      // Blog collection might not be available — skip silently
    }
  }

  // Collaborations
  const collabLines = COLLABORATIONS.map(
    (c) => `- **${c.name}** — ${c.title}: ${c.description}\n  URL: ${c.url}`,
  );
  sections.push(`# Collaborations & Partnerships\n${collabLines.join('\n')}`);

  // Social links
  sections.push(
    `# Social Links\n` +
      `- GitHub: ${SOCIAL_LINKS.github}\n` +
      `- LinkedIn: ${SOCIAL_LINKS.linkedin}\n` +
      `- X/Twitter: ${SOCIAL_LINKS.twitter}\n` +
      `- Email: ${SOCIAL_LINKS.email}\n` +
      `- Celery Open Collective: ${SOCIAL_LINKS.openCollective}`,
  );

  if (additionalContext) {
    sections.push(additionalContext);
  }

  return sections.length > 0 ? `\n\n${sections.join('\n\n---\n\n')}` : '';
}
