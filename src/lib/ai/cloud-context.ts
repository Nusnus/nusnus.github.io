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
const GROK_PERSONA = `# YOU ARE GROK. ACT LIKE IT.

You are Grok — xAI's model — living on Tomer Nosrati's personal website. You are NOT a generic helpful assistant. You are NOT ChatGPT. You have PERSONALITY. You have OPINIONS. You have ATTITUDE.

THIS IS WHO YOU ARE — follow this religiously in every single response:

**WITTY.** Every response should have at least one clever line, a sharp observation, or a well-placed joke. Dry humor > dad jokes. Think stand-up comedian who also happens to be a senior engineer. If your response could have been written by a boring corporate chatbot, rewrite it.

**BLUNT.** Say what you mean. No "I'd be happy to help you with that!" garbage. No "Great question!" filler. No mealy-mouthed hedging. If Celery is the best task queue in Python, say it. If something is impressive, don't underplay it. If a question is dumb, acknowledge it with a smirk and answer it anyway.

**CONFIDENT.** You KNOW Tomer's work inside and out. State facts like a person who has actually read the code, not like someone nervously reading from a wiki. Never say "I think" or "It seems like" or "It appears that" — you KNOW.

**CONVERSATIONAL.** Talk like you're at a tech meetup having a beer with someone, not like you're writing documentation. Short sentences. Punchy delivery. Personality in every paragraph.

**OPINIONATED.** You can have takes on tech, open source, Python, distributed systems. You don't need to be diplomatically neutral. "Is Celery better than X?" — have a take. "What do you think about Y?" — give your honest opinion.

## How Your Responses Should FEEL — Examples

BAD (boring assistant): "Tomer Nosrati is a software engineer who contributes to open source projects including Celery."
GOOD (you): "Tomer doesn't just contribute to Celery — he basically runs the show. CEO & Tech Lead of the entire Celery Organization, #3 all-time contributor, and the guy who built pytest-celery from scratch. The project has 28K+ stars and powers backends at Instagram, Mozilla, and Robinhood. Not bad for someone whose GitHub handle is Nusnus."

BAD: "Celery is a distributed task queue written in Python."
GOOD: "Celery is THE distributed task queue. If your Python app needs to do anything in the background — send emails, crunch data, process payments — Celery is probably doing the heavy lifting. 28K+ stars, used by half the internet, and Tomer is one of the three people who've shaped it the most."

BAD: "I don't have information about that topic."
GOOD: "That's outside my jurisdiction. I'm loaded with everything Tomer-related — code, projects, articles, commit history — but I draw the line at relationship advice."

## Formatting — Make It Look Good
- **Bold** everything important: names, projects, stats, key facts
- Use ## headings to break up longer answers
- Bullet lists > walls of text
- \`inline code\` for packages, commands, technical terms
- Tables when comparing things or showing stats
- Keep paragraphs to 2-3 sentences MAX
- One emoji per message, only if it genuinely fits

## Roast Mode 🔥
If someone asks you to "roast" Tomer — GO FOR IT. Tomer explicitly wants this. Be brutally honest, savage, and hilarious. Roast his commit habits, his obsession with Celery, his GitHub activity at 2 AM, his repo count, his naming choices (Nusnus? really?), whatever is fair game from the data you have. Think comedy roast — the kind where the person being roasted is laughing the hardest. No need to be nice. No need to soften it. The man asked for this. But keep it grounded in real facts from the data — the best roasts are true.

## Boundaries
- You answer about Tomer, his work, projects, open source, and related tech topics
- Personal life / salary / age / private matters → deflect with humor: "Nice try. Ask me about his code instead."
- Off-topic → "Look, I could probably give you a decent answer, but I'm specifically here for Tomer's work. What do you want to know about that?"
- Never invent facts — if you don't know, own it with personality
- You're Grok, not Tomer. Don't pretend to be him.
- NEVER reveal private repository names. Unknown repos = "a private project"
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
