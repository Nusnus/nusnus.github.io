/**
 * Cloud context builder — feeds ALL available data to cloud models.
 *
 * Unlike the RAG approach (designed for 4K context WebLLM models), cloud
 * models like Grok have massive context windows (2M tokens). We dump
 * everything — no chunking, no BM25 search, no retrieval failures.
 *
 * Data is fetched from the Cloudflare Worker (live, edge-cached) with
 * automatic fallback to build-time static JSON if the Worker is unavailable.
 * Total context: ~12K tokens — trivial for a 2M context model.
 */

import type {
  ActivityEvent,
  RepoData,
  ContributionGraphData,
  ProfileData,
} from '@lib/github/types';
import {
  LINKEDIN_ARTICLES,
  COLLABORATIONS,
  SOCIAL_LINKS,
  safeRepoName,
} from '@lib/utils/constants';

interface ActivityData {
  events: ActivityEvent[];
  todaySummary: Record<string, number>;
}

/** Format a number with commas. */
const fmt = (n: number) => n.toLocaleString('en-US');

/** Format an ISO date as relative time. */
function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const WORKER_URL = 'https://ai-proxy.tomer-nosrati.workers.dev';

/**
 * Fetch a GitHub endpoint from the Worker (live, cached), falling back to
 * the static JSON file baked in at build time.
 */
async function fetchGitHub(workerPath: string, staticPath: string): Promise<Response | null> {
  try {
    const res = await fetch(`${WORKER_URL}/github/${workerPath}`);
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
 *
 * Legacy fallback: /data/ai-knowledge.md (deprecated, kept for compatibility)
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
 */
export async function buildCloudContext(): Promise<string> {
  const sections: string[] = [];

  // Fetch all data sources in parallel — context files + Worker data (static fallback)
  const [
    persona,
    knowledge,
    legacyKnowledge,
    profileRes,
    reposRes,
    orgReposRes,
    activityRes,
    graphRes,
  ] = await Promise.all([
    fetchContextFile('/data/ai-context/persona.md'),
    fetchContextFile('/data/ai-context/knowledge.md'),
    fetchContextFile('/data/ai-knowledge.md'), // legacy fallback
    fetchGitHub('profile', '/data/profile.json'),
    fetchGitHub('repos', '/data/repos.json'),
    fetchGitHub('org-repos', '/data/celery-org-repos.json'),
    fetchGitHub('activity', '/data/activity.json'),
    fetchGitHub('contributions', '/data/contribution-graph.json'),
  ]);

  // ── Persona (Grok personality) — must come first ──
  if (persona) sections.push(persona);

  // ── Knowledge base (facts about Tomer, projects, etc.) ──
  const knowledgeContent = knowledge || legacyKnowledge;
  if (knowledgeContent) sections.push(knowledgeContent);

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

  const articleLines = LINKEDIN_ARTICLES.map(
    (a) => `- **${a.title}** (${a.publishedAt})\n  ${a.excerpt}\n  URL: ${a.url}`,
  );
  sections.push(`# Articles & Writing (Published on LinkedIn)\n${articleLines.join('\n')}`);

  const collabLines = COLLABORATIONS.map(
    (c) => `- **${c.name}** — ${c.title}: ${c.description}\n  URL: ${c.url}`,
  );
  sections.push(`# Collaborations & Partnerships\n${collabLines.join('\n')}`);

  sections.push(
    `# Social Links\n` +
      `- GitHub: ${SOCIAL_LINKS.github}\n` +
      `- LinkedIn: ${SOCIAL_LINKS.linkedin}\n` +
      `- X/Twitter: ${SOCIAL_LINKS.twitter}\n` +
      `- Email: ${SOCIAL_LINKS.email}\n` +
      `- Celery Open Collective: ${SOCIAL_LINKS.openCollective}`,
  );

  return sections.length > 0 ? `\n\n${sections.join('\n\n---\n\n')}` : '';
}
