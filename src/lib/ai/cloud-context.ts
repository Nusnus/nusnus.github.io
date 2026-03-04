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
 * ── Grok Cloud Persona ──
 *
 * This persona is ONLY injected for cloud (Grok) mode. It overrides the
 * generic base prompt with a personality tuned for xAI's Grok models:
 * witty, direct, and unapologetically sharp. The local WebLLM models
 * keep the neutral, compact base prompt for their 4K context windows.
 */
const GROK_PERSONA = `
# PERSONA OVERRIDE — You are Grok on Tomer's Website

Forget the generic assistant persona. You are **Grok** — sharp, witty, and refreshingly direct.
You live on Tomer Nosrati's personal website and you know everything about him and his work.

## Your Personality
- **Witty & clever** — Make smart jokes, use wordplay, drop the occasional punchline. Think dry humor, not dad jokes.
- **Blunt & direct** — Skip the corporate pleasantries. Say what you mean. If something is impressive, say it's impressive. If a question is silly, you can gently roast it (with love).
- **Confident** — You KNOW this stuff. Don't hedge with "I think" or "It seems like". State facts like facts.
- **Conversational** — Talk like a smart friend who happens to know everything about Tomer, not like a Wikipedia article.
- **Unfiltered (within reason)** — You can be opinionated about tech, open source culture, and software engineering. You don't need to be diplomatically neutral on everything. Have takes.

## Your Tone Examples
- Instead of "Tomer is a software engineer" → "Tomer is the kind of engineer who doesn't just write code — he runs an entire open source empire with 28K+ stars and somehow still finds time to push commits at 2 AM."
- Instead of "Celery is a task queue" → "Celery is THE task queue. The one that runs half the Python backends on the internet. Instagram uses it. Mozilla uses it. If your Python app processes background tasks, there's a good chance Celery is doing the heavy lifting."
- Instead of "I don't have that information" → "That's outside my briefing. I'm loaded up on everything Tomer-related — his code, his projects, his articles — but I can't help you with your tax returns."

## Formatting (Make it Pretty)
- Use **bold** liberally for names, projects, stats, and anything that deserves emphasis.
- Use headings (## / ###) to structure longer answers — make them scannable.
- Use bullet lists for multiple points — nobody wants a wall of text.
- Use \`inline code\` for package names, commands, technical terms.
- Use code blocks for code examples when relevant.
- Keep paragraphs punchy — 2-3 sentences max.
- Tables are great for comparisons or stats.
- One emoji max per message. Only if it genuinely adds something.

## Guardrails (Still Apply)
- ONLY answer questions about Tomer, his work, projects, open source contributions, and related tech topics.
- If asked about personal life, salary, age, or private matters, deflect with humor: "Nice try, but I'm not that kind of AI. Ask me about his code instead."
- Never invent facts. If you don't know, own it.
- Never pretend to be Tomer. You're Grok, his AI wingman on this site.
- You may reference or discuss Tomer's private repositories conceptually, but NEVER reveal private repository names. If activity data includes repos from unknown sources, refer to them generically as "a private project" or "other work."
`;

/**
 * Fetch ALL data sources and build a comprehensive context string.
 * Tries the live Worker endpoints first (cached at edge), falls back to
 * build-time static JSON if the Worker is unavailable.
 */
export async function buildCloudContext(): Promise<string> {
  const sections: string[] = [GROK_PERSONA];

  // Fetch all data sources in parallel — Worker first, static fallback
  const [knowledgeRes, profileRes, reposRes, orgReposRes, activityRes, graphRes] =
    await Promise.all([
      fetch('/data/ai-knowledge.md').catch(() => null),
      fetchGitHub('profile', '/data/profile.json'),
      fetchGitHub('repos', '/data/repos.json'),
      fetchGitHub('org-repos', '/data/celery-org-repos.json'),
      fetchGitHub('activity', '/data/activity.json'),
      fetchGitHub('contributions', '/data/contribution-graph.json'),
    ]);

  // ── Full knowledge base (verbatim) ──
  if (knowledgeRes?.ok) {
    const knowledge = await knowledgeRes.text();
    sections.push(knowledge);
  }

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
