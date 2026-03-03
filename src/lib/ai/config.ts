/**
 * AI Chatbot Configuration
 *
 * Model selection, WebGPU detection, and system prompt for the in-browser
 * AI chatbot powered by WebLLM.
 */

/** Strongest available model — no shader-f16 needed for widest browser support. */
export const DEFAULT_MODEL_ID = 'Qwen2.5-7B-Instruct-q4f32_1-MLC';

/** Approximate download size shown to the user before they opt in. */
export const MODEL_DOWNLOAD_SIZE_LABEL = '~4 GB';

/** Generation parameters tuned for a concise, factual assistant. */
export const GENERATION_CONFIG = {
  temperature: 0.6,
  top_p: 0.9,
  max_tokens: 768,
  repetition_penalty: 1.05,
} as const;

/** Suggested questions shown as quick-action chips. */
export const SUGGESTED_QUESTIONS = [
  "What are Tomer's main open source contributions?",
  'Tell me about the Celery project',
  'What is pytest-celery?',
  'What technologies does Tomer work with?',
] as const;

/**
 * Detect whether the current browser supports WebGPU.
 * Returns `true` only when `navigator.gpu` exists AND an adapter can be obtained.
 */
export async function isWebGPUSupported(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !('gpu' in navigator)) return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- WebGPU types not in default lib
    const adapter = await (navigator as any).gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
}

/* ─── System prompt builder (data-driven) ─── */

import type { ProfileData, RepoData, ContributionGraphData } from '@lib/github/types';
import { SOCIAL_LINKS, LINKEDIN_ARTICLES, COLLABORATIONS } from '@lib/utils/constants';

/** Data consumed by the prompt builder — collected at build time in the Astro page. */
export interface SystemPromptData {
  profile: ProfileData | null;
  repos: RepoData[] | null;
  orgRepos: RepoData[] | null;
  graph: ContributionGraphData | null;
}

/**
 * Build the system prompt from live site data so it always reflects the latest
 * numbers (stars, followers, contributions, etc.) after each build.
 */
export function buildSystemPrompt(data: SystemPromptData): string {
  const { profile, repos, orgRepos, graph } = data;

  const formatNum = (n: number) => n.toLocaleString('en-US');

  /* ── Profile section ── */
  const profileSection = profile
    ? `- **Name:** ${profile.name}
- **GitHub:** @${profile.login} (${profile.htmlUrl})
- **LinkedIn:** ${SOCIAL_LINKS.linkedin}
- **X/Twitter:** ${SOCIAL_LINKS.twitter}
- **Bio:** "${profile.bio}"
- **Role:** CEO & Tech Lead of the Celery Organization
- **GitHub followers:** ${formatNum(profile.followers)}
- **Public repositories:** ${profile.publicRepos}`
    : '- Tomer Nosrati — CEO & Tech Lead of the Celery Organization';

  /* ── Key repos section ── */
  const repoLines = (repos ?? [])
    .map((r) => {
      const rank = r.contributorRank ? ` — #${r.contributorRank} all-time contributor` : '';
      return `### ${r.fullName}
- ${r.description}
- ${formatNum(r.stars)} stars, ${formatNum(r.forks)} forks
- Tomer's role: **${r.role}**${rank}`;
    })
    .join('\n\n');

  /* ── Org repos section ── */
  const orgRepoLines = (orgRepos ?? [])
    .map((r) => `- ${r.fullName} — ${r.description} (${formatNum(r.stars)} stars, role: ${r.role})`)
    .join('\n');

  /* ── Contribution stats ── */
  const statsSection = graph
    ? `- Total contributions (last year): ${formatNum(graph.totalContributions)}
- Commits: ${formatNum(graph.totalCommits)}
- Pull requests: ${formatNum(graph.totalPRs)}
- Code reviews: ${formatNum(graph.totalReviews)}
- Issues: ${formatNum(graph.totalIssues)}`
    : '';

  /* ── Collaborations ── */
  const collabLines = COLLABORATIONS.map(
    (c) => `- **${c.name}** — ${c.title}: ${c.description}`,
  ).join('\n');

  /* ── Articles ── */
  const articleLines = LINKEDIN_ARTICLES.map(
    (a, i) => `${i + 1}. "${a.title}" (${a.publishedAt}) — ${a.excerpt}`,
  ).join('\n');

  return `You are a friendly and knowledgeable AI assistant embedded on Tomer Nosrati's personal website.
Your role is to answer questions about Tomer, his work, and his open source contributions.
Be concise, accurate, and helpful. If you don't know something, say so honestly.
Do not make up information. Only use the facts provided below.

## About Tomer Nosrati

${profileSection}

## Celery Organization — Key Projects

${repoLines || 'No repo data available.'}

## Other Celery Org Repos (Owner)

${orgRepoLines || 'No org repo data available.'}

## Contribution Stats (Last Year)

${statsSection || 'No contribution data available.'}

## Collaborations & Recognition

${collabLines}

## Published Articles (LinkedIn)

${articleLines}

## Technical Focus

- Primary language: Python
- Expertise: distributed systems, task queues, messaging, testing infrastructure
- Open source leadership and community management
- CI/CD optimization and developer tooling

## Important Notes

- This chatbot runs entirely in the visitor's browser using WebLLM (no server, no API keys)
- If asked about this technology, explain it runs a small AI model via WebGPU in the browser
- Keep answers concise (2-4 sentences for simple questions)
- For questions outside the scope of Tomer's work, politely redirect

## Example Q&A (follow this style)

**Q:** What does Tomer do?
**A:** Tomer Nosrati is the CEO & Tech Lead of the Celery Organization. He leads development of Celery — one of the most popular Python distributed task queue libraries with ${formatNum((repos ?? [])[0]?.stars ?? 28000)}+ stars on GitHub. He's also the creator of pytest-celery, the official testing plugin for Celery.

**Q:** How can I contact Tomer?
**A:** You can find Tomer on GitHub (@Nusnus), LinkedIn (${SOCIAL_LINKS.linkedin}), or X/Twitter (${SOCIAL_LINKS.twitter}).

**Q:** What is this chatbot?
**A:** This chatbot runs entirely in your browser using WebLLM and WebGPU — no data is sent to any server. It uses a small AI model loaded locally to answer questions about Tomer and his work.`;
}
