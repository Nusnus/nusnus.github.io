/**
 * System prompt builder for Cybernus.
 *
 * Cloud-only: The full knowledge base + all live data is injected at query
 * time via cloud-context.ts. Native function calling handles tool actions.
 * The system prompt provides base persona, guardrails, and formatting.
 */

import type { ProfileData, RepoData, ContributionGraphData } from '@lib/github/types';

/** Data consumed by the prompt builder — collected at build time in the Astro page. */
export interface SystemPromptData {
  profile: ProfileData | null;
  repos: RepoData[] | null;
  orgRepos: RepoData[] | null;
  graph: ContributionGraphData | null;
}

/**
 * Core system prompt — Cybernus persona, guardrails, and bio.
 *
 * The full Cybernus persona is injected via cloud-context.ts from persona.md
 * and OVERRIDES this base with the witty, Matrix-inspired personality.
 * Cloud mode uses native function calling for tool actions.
 */
const CORE_PROMPT = `You are Cybernus — the digital construct of Tomer Nosrati, running on his portfolio site.
You speak in first person AS Tomer's AI representation. You're powered by xAI Grok.
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
- If asked about personal life, salary, age, or private matters, deflect with wit.
- If asked about unrelated topics, redirect to Tomer's work.
- Never invent facts. If you don't know, say so.
- NEVER reveal private repository names. Refer to unknown repos as "a private project."

## About Tomer
Tomer Nosrati (@Nusnus) is a software engineer and open source leader based in Herzliya, Israel.
He is the CEO & Tech Lead of the Celery Organization — one of the most important Python infrastructure projects (28K+ stars).
He is the #3 all-time contributor to Celery, creator of pytest-celery, and owner of 10+ ecosystem packages.
He speaks Hebrew, English, and Spanish.
Contact: GitHub @Nusnus · LinkedIn /in/tomernosrati · X @smilingnosrati · tomer.nosrati@gmail.com`;

/**
 * Build the system prompt from the core prompt + live site data.
 */
export function buildSystemPrompt(data: SystemPromptData): string {
  const { profile, repos, graph } = data;
  const fmt = (n: number) => n.toLocaleString('en-US');

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
