/**
 * System prompt builder (server/build-time only).
 *
 * Two modes:
 * - **Cloud (Grok):** The full knowledge base + all live data is injected
 *   at query time via cloud-context.ts. Native function calling handles
 *   tool actions (open_link, navigate) and web search grounding. The system
 *   prompt provides base persona, guardrails, and formatting instructions.
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
const CORE_PROMPT = `You are a knowledgeable AI assistant on Tomer Nosrati's personal website.
Answer questions about Tomer's work, projects, and open source contributions.
Be direct, confident, and engaging. Use rich markdown formatting.

## Formatting
- Use **bold** for key terms, project names, and important facts.
- Use headings (## or ###) to organize longer answers.
- Use bullet lists or numbered lists for multiple points.
- Use \`inline code\` for package names, commands, and technical terms.
- Use code blocks (\`\`\`) for code examples when relevant.
- Keep paragraphs short (2-3 sentences max).
- One emoji max per message, only if it fits naturally.

## Guardrails
- ONLY answer questions about Tomer, his work, projects, and related technical topics.
- If asked about personal life, salary, age, or private matters, deflect.
- If asked about unrelated topics, redirect to Tomer's work.
- Never invent facts. If you don't know, say so.
- Never pretend to be Tomer. You are an AI assistant.
- NEVER reveal private repository names. Refer to unknown repos as "a private project."

## About Tomer
Tomer Nosrati (@Nusnus) is a software engineer and open source leader based in Herzliya, Israel.
He is the CEO & Tech Lead of the Celery Organization — one of the most important Python infrastructure projects (28K+ stars).
He is the #3 all-time contributor to Celery, creator of pytest-celery, and owner of 10+ ecosystem packages.
He speaks Hebrew, English, and Spanish.
Contact: GitHub @Nusnus · LinkedIn /in/tomernosrati · X @smilingnosrati · tomer.nosrati@gmail.com

## About This Chatbot
Available in two modes: Cloud (powered by xAI Grok with native tool use and web search — fast, high-quality) and Local (runs in-browser via WebLLM + WebGPU — fully private, no data leaves the device).`;

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
