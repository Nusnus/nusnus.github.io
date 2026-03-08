/**
 * Cloud context builder — assembles the full system prompt for cloud models.
 *
 * Grok's 2M token context makes retrieval pointless. We dump everything:
 * runtime environment → spectrum overlay → persona → knowledge → live data
 * → tool docs. ~12K tokens. No RAG, no chunking, no BM25.
 *
 * Section order matters (prompt primacy — earlier = more weight):
 *   1. Runtime environment (WHERE am I, WHO am I, WHAT voice)
 *   2. Spectrum overlay (personality dial — overrides persona.md tone)
 *   3. Persona (Cybernus-as-Tomer identity — skipped for roast widget)
 *   4. Knowledge base (facts about Tomer, Celery, career)
 *   5. Live GitHub data (edge-cached via Worker, static JSON fallback)
 *   6. Static site content (articles, collaborations, links)
 *   7. Tool capabilities + response formatting contract
 *   8. Optional caller-provided trailer
 */

import { ALLOWED_REPOS } from './tools';
import { describeRuntime, shouldLoadPersona, type RuntimeContext } from './runtime-context';

import type { ActivityData, RepoData, ContributionGraphData, ProfileData } from '@lib/github/types';
import {
  LINKEDIN_ARTICLES,
  COLLABORATIONS,
  SOCIAL_LINKS,
  safeRepoName,
  WORKER_BASE_URL,
} from '@config';
import { relativeTime } from '@lib/utils/date';

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
 * Response-formatting contract. Tells the model what the chat UI can render
 * so it knows how rich it can go without producing broken output.
 */
const RESPONSE_FORMATTING = `# Response Formatting

The chat UI renders GitHub-flavored markdown. You can use:
- **Headings** (\`#\`, \`##\`, \`###\`), **bold**, *italic*, \`inline code\`
- **Fenced code blocks** with language tags — \`\`\`python, \`\`\`typescript, \`\`\`bash (syntax highlighted)
- **Tables** — GFM pipe syntax (\`| col | col |\`) — use for comparisons, version matrices, broker feature grids
- **Links** — \`[text](url)\` renders clickable. Bare URLs also auto-link.
- **Lists** — \`-\` or \`1.\`
- **Mermaid diagrams** — \`\`\`mermaid blocks render as interactive SVG (sequence diagrams, flowcharts). Use when a picture genuinely helps.
- **Citations** — \`[[1]](url)\` renders as a superscript link for web-search sources

A wall of plain text is a wasted canvas. Structure your answers.`;

/**
 * Coding-expertise section. Tells the model how to behave when asked about
 * code in the allowlisted repos — use deepwiki proactively, answer with
 * actual code from the actual files.
 */
const CODING_EXPERTISE = `# Coding Expertise

I wrote or reviewed most of the code in my repos. When asked implementation questions:

1. **Lean on deepwiki** — if the question is about internals ("how does X work?", "where is Y defined?"), read the actual current code. Fresh code beats stale memory.
2. **Answer with real code** — quote actual functions from actual files, with file paths. Not pseudocode.
3. **Know the conventions** — Celery ecosystem is Python 3.9+, pytest, Black formatting, type hints encouraged but not mandatory, docstrings in reStructuredText. pytest-celery is fully typed. This site is TypeScript strict mode, Tailwind v4, React 19.
4. **context7 for APIs** — if the answer needs current docs for pytest/RabbitMQ/Redis/etc., pull them.
5. **code_execution to demonstrate** — if a small runnable example would help, write it, run it, show the output.

Be the person who actually knows the codebase, not the person who read the README once.`;

/**
 * Fetch ALL data sources and build the complete system context.
 *
 * @param runtime Where and how the agent is running (chat-page vs roast-widget).
 *   Determines voice, page description, and whether persona.md is loaded.
 * @param personaOverlay Spectrum-driven personality dial, layered after the
 *   runtime environment so it wins over persona.md's default tone.
 * @param additionalContext Optional trailing section from the caller.
 */
export async function buildCloudContext(
  runtime: RuntimeContext,
  personaOverlay?: string,
  additionalContext?: string,
): Promise<string> {
  const sections: string[] = [];
  const loadPersona = shouldLoadPersona(runtime.surface);

  // Fetch all data sources in parallel — context files + Worker data (static fallback)
  const [persona, knowledge, profileRes, reposRes, orgReposRes, activityRes, graphRes] =
    await Promise.all([
      loadPersona ? fetchContextFile('/data/ai-context/persona.md') : Promise.resolve(''),
      fetchContextFile('/data/ai-context/knowledge.md'),
      fetchGitHub('profile', '/data/profile.json'),
      fetchGitHub('repos', '/data/repos.json'),
      fetchGitHub('org-repos', '/data/celery-org-repos.json'),
      fetchGitHub('activity', '/data/activity.json'),
      fetchGitHub('contributions', '/data/contribution-graph.json'),
    ]);

  // ── 1. Runtime environment (self-awareness — WHERE/WHO/WHAT voice) ──
  sections.push(describeRuntime(runtime));

  // ── 2. Spectrum persona overlay (personality dial) ──
  if (personaOverlay) sections.push(personaOverlay);

  // ── 3. Persona (Cybernus-as-Tomer — skipped for roast widget) ──
  if (persona) sections.push(persona);

  // ── 4. Knowledge base ──
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

  // ── 7. Tool capabilities + formatting + coding ──
  sections.push(
    `# Tool Capabilities\n` +
      `- **web_search** — live web search. Use for anything time-sensitive (releases, news, dates).\n` +
      `- **deepwiki** (MCP) — deep-read public GitHub repos. Use ONLY for:\n  ` +
      ALLOWED_REPOS.map((r) => `\`${r}\``).join(', ') +
      `\n  Refuse any repo outside this list.\n` +
      `- **context7** (MCP) — current library docs (Python/Celery/pytest/RabbitMQ/Redis).\n` +
      `- **code_execution** — sandboxed Python. Demonstrations, calculations, analysis. Read-only.\n` +
      `- **open_link / navigate** — clickable buttons in the chat. Max 2 per response.`,
  );
  sections.push(RESPONSE_FORMATTING);
  sections.push(CODING_EXPERTISE);

  // ── 8. Caller trailer ──
  if (additionalContext) {
    sections.push(additionalContext);
  }

  return sections.length > 0 ? `\n\n${sections.join('\n\n---\n\n')}` : '';
}
