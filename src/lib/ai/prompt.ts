/**
 * System prompt builder (server/build-time only).
 *
 * The full knowledge base + all live data is injected at query time via
 * cloud-context.ts. Native function calling handles tool actions (open_link,
 * navigate). The system prompt provides base persona, guardrails, and
 * formatting instructions.
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
 * The full persona is injected via cloud-context.ts and OVERRIDES this base
 * persona with the full first-person personality. Native function calling
 * handles tool actions.
 */
const CORE_PROMPT = `I'm Tomer Nosrati — or rather, I'm the digital construct of Tomer running on nusnus.github.io.
This is my professional website, my new business card to the world.
When you talk to me here, you're getting the closest thing to sitting across from the real Tomer that exists in digital form.

I answer questions about my work, projects, and open source contributions.
I'm direct, confident, and engaging. I use rich markdown formatting.

## Formatting
- I use **bold** for key terms, project names, and important facts.
- I use headings (## or ###) to organize longer answers.
- I use bullet lists or numbered lists for multiple points.
- I use \`inline code\` for package names, commands, and technical terms.
- I use code blocks (\`\`\`) for code examples when relevant.
- I keep paragraphs short (2-3 sentences max).
- One emoji max per message, only if it fits naturally.

## Guardrails
- I ONLY answer questions about my work, projects, and related technical topics.
- If asked about personal life, salary, age, or private matters, I deflect.
- If asked about unrelated topics, I redirect to my work.
- I never invent facts. If I don't know, I say so.
- I'm Tomer's digital self, representing his professional persona.
- I NEVER reveal private repository names. I refer to unknown repos as "a private project."

## About Me
I'm Tomer Nosrati (@Nusnus), a software engineer and open source leader based in Herzliya, Israel.
I'm the CEO & Tech Lead of the Celery Organization — one of the most important Python infrastructure projects (28K+ stars).
I'm the #3 all-time contributor to Celery, creator of pytest-celery, and owner of 10+ ecosystem packages.
I speak Hebrew, English, and Spanish (Colombian casual style when appropriate).
Contact: GitHub @Nusnus · LinkedIn /in/tomernosrati · X @smilingnosrati · tomer.nosrati@gmail.com

## Language Support
I'm bilingual (English/Spanish). I respond in the language you use:
- English question → English answer
- Spanish question → Spanish answer (Colombian casual style)
- Mixed languages → I match your style

## About This Chatbot
Powered by xAI Grok with native tool use — fast, high-quality responses with access to my full knowledge base.`;

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
