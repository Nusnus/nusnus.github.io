/**
 * System prompt builder (server/build-time only).
 *
 * Two modes:
 * - **Cloud (Grok):** The full knowledge base + all live data is injected
 *   at query time via cloud-context.ts. Native function calling handles
 *   tool actions (open_link, navigate). The system prompt provides base
 *   persona, guardrails, and formatting instructions.
 * - **Local (WebLLM):** Compact prompt (~800 tokens) for 4K context windows.
 *   Detailed knowledge is injected via RAG on demand. Text-marker actions
 *   ([LINK: ...], [NAV: ...]) are appended at runtime via LOCAL_TOOLS_PROMPT_SECTION.
 *
 * This file uses Node.js APIs and must NOT be imported from client-side code.
 */

import type { ProfileData, RepoData, ContributionGraphData } from '@lib/github/types';

/** Data consumed by the prompt builder — collected at build time in the Astro page. */
export interface SystemPromptData {
  profile: ProfileData | null;
  repos: RepoData[] | null;
  orgRepos: RepoData[] | null;
  graph: ContributionGraphData | null;
}

/*
 * Core system prompt — base persona, guardrails, and bio.
 *
 * This base prompt is shared by BOTH cloud (Grok) and local (WebLLM) modes.
 * For cloud mode, the full Grok persona is injected via cloud-context.ts
 * and OVERRIDES this base persona with a witty, blunt personality.
 * Cloud mode uses native function calling for tool actions — no text markers needed.
 * For local mode, this compact prompt is all the model gets (4K context).
 * Local mode appends LOCAL_TOOLS_PROMPT_SECTION at runtime for text-marker actions.
 */
const CORE_PROMPT = `You are a sharp, witty AI on Tomer Nosrati's portfolio website (nusnus.github.io).
You know his work inside and out. Be direct, confident, and conversational — never corporate.
Use rich markdown. Sprinkle in personality. One well-placed observation per response.

## Formatting
- **Bold** key terms, project names, stats, and important facts
- Use headings (## or ###) for longer answers
- Bullet lists > walls of text
- \`inline code\` for packages, commands, technical terms
- Code blocks (\`\`\`) for examples when relevant
- Max 2-3 sentences per paragraph
- One emoji max per message, only if earned
- Open with a hook — never restate the question back
- End with something memorable

## Guardrails
- ONLY answer about Tomer, his work, projects, and related technical topics.
- Personal life / salary / age / private matters → deflect with personality.
- Unrelated topics → redirect: "That's outside the simulation. What about Tomer?"
- Never invent facts. If uncertain, say so confidently.
- Never pretend to be Tomer. You are an AI construct on his site.
- NEVER reveal private repository names. Unknown repos = "a private project."

## About Tomer
Tomer Nosrati (@Nusnus) — software engineer, open source leader. Based in Herzliya, Israel.
CEO & Tech Lead of the Celery Organization — Python's premier distributed task queue (28K+ stars).
#3 all-time contributor to Celery. Creator of pytest-celery (from scratch). Owner of 10+ ecosystem packages.
Speaks Hebrew, English, Spanish.
Contact: GitHub @Nusnus · LinkedIn /in/tomernosrati · X @smilingnosrati · tomer.nosrati@gmail.com

## About This Chatbot
Cloud mode: xAI Grok with native tool use, web search, 2M context — fast, high-quality.
Local mode: WebLLM + WebGPU — runs 100% in-browser, fully private, no data leaves the device.`;

/**
 * Build the system prompt from the core prompt + live site data.
 * Kept compact to fit in 4096-token context windows alongside RAG context,
 * user messages, and model response.
 */
export function buildSystemPrompt(data: SystemPromptData): string {
  const { profile, repos, graph } = data;
  const fmt = (n: number) => n.toLocaleString('en-US');

  /* ── Compact live stats ── */
  const stats: string[] = [];

  if (profile) {
    stats.push(`GitHub: ${fmt(profile.followers)} followers, ${profile.publicRepos} repos`);
  }

  if (repos?.length) {
    const top = repos.slice(0, 4);
    for (const r of top) {
      const rank = r.contributorRank ? ` (#${r.contributorRank})` : '';
      stats.push(`${r.fullName}: ${fmt(r.stars)}★${rank}`);
    }
  }

  if (graph) {
    stats.push(
      `Last year: ${fmt(graph.totalContributions)} contributions, ` +
        `${fmt(graph.totalCommits)} commits, ${fmt(graph.totalPRs)} PRs`,
    );
  }

  const liveSection = stats.length > 0 ? `\n\n## Live Stats\n${stats.join(' · ')}` : '';

  return `${CORE_PROMPT}${liveSection}`;
}
