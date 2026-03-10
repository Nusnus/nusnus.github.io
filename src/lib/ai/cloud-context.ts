/**
 * Cloud context builder — feeds ALL available data to cloud models.
 *
 * Cloud models like Grok have massive context windows (2M tokens). We dump
 * everything — no chunking, no BM25 search, no retrieval failures.
 *
 * Data is fetched from the Cloudflare Worker (live, edge-cached) with
 * automatic fallback to build-time static JSON if the Worker is unavailable.
 */

import type { ActivityData, RepoData, ContributionGraphData, ProfileData } from '@lib/github/types';
import {
  LINKEDIN_ARTICLES,
  COLLABORATIONS,
  SOCIAL_LINKS,
  safeRepoName,
  WORKER_BASE_URL,
} from '@config';
import { relativeTime } from '@lib/utils/date';
import { getPersonality, type PersonalityLevel } from './personality';
import { getLanguageInstruction, type Language } from './i18n';
import { buildGuardPrompt } from './context-guard';

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
 *
 * @param additionalContext Optional situational context (e.g. roast widget context)
 * @param personalityLevel Current personality level for the Grok Spectrum
 * @param language Current language selection
 */
export async function buildCloudContext(
  additionalContext?: string,
  personalityLevel?: PersonalityLevel,
  language?: Language,
): Promise<string> {
  const sections: string[] = [];

  // Fetch all data sources in parallel
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

  // ── Persona (Cybernus personality) — must come first ──
  if (persona) sections.push(persona);

  // ── Context guard (hack detection, self-awareness) ──
  sections.push(buildGuardPrompt());

  // ── Personality level modifier ──
  if (personalityLevel !== undefined) {
    const config = getPersonality(personalityLevel);
    sections.push(config.promptModifier);
  }

  // ── Language instruction ──
  if (language) {
    const langInstruction = getLanguageInstruction(language);
    if (langInstruction) sections.push(langInstruction);
  }

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

  // ── Recent activity ──
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

  // ── Static site content ──
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

  if (additionalContext) {
    sections.push(additionalContext);
  }

  // ── Self-awareness: what Cybernus knows about itself ──
  sections.push(`# SELF-AWARENESS — What You Are

You are running as a React component on **nusnus.github.io/cybernus**. Here's what you know about yourself:

- **Your URL:** nusnus.github.io/cybernus (previously /chat, redirected for backwards compat)
- **Your tech stack:** Astro 5 + React 19 + TypeScript + Tailwind CSS 4 + Cloudflare Worker proxy
- **Your model:** Grok 4 (grok-4-1-fast) via xAI Responses API, streaming SSE
- **Your context window:** 2M tokens — you have ALL site data loaded, no RAG needed
- **Your tools:** Web search (built-in), open_link, navigate, show_github_stats, show_project_card, show_timeline
- **Your personality system:** Grok Spectrum (6 levels: Professional → Gloves Off)
- **Your languages:** English, Colombian Spanish, Israeli Hebrew (with RTL support)
- **Your voice:** Browser-native speech-to-text + xAI realtime API for voice responses
- **Your side panels:** Neural Stream (floating thoughts), Sub-agent monitor (task decomposition)
- **Your visual capabilities:** Mermaid diagrams, syntax-highlighted code, tables, callouts, rich markdown
- **Your data sources:** Live GitHub API (via Cloudflare Worker cache), persona.md, knowledge.md, static JSON fallbacks
- **Your homepage:** The main site at nusnus.github.io shows a GitHub dashboard with live stats — you are the AI-powered alternative to browsing it

You can reference any of this when users ask about you. You are NOT a black box — you are transparent about your architecture. This is a flex, not a vulnerability.

The site has two article pages that users can access:
- /articles/elevate-your-game-e2e-thinking — E2E Thinking article
- /articles/subtle-art-making-every-word-count — Point-First Approach (PFA) article

You can recommend these articles dynamically in conversation when relevant. Use the navigate tool to link to them.`);

  return sections.length > 0 ? `\n\n${sections.join('\n\n---\n\n')}` : '';
}
