/**
 * System prompt builder (server/build-time only).
 *
 * The system prompt is intentionally compact (~800 tokens) to fit within
 * the 4096-token context windows used by all WebLLM models. Detailed
 * knowledge lives in ai-knowledge.md and is injected via RAG on demand.
 *
 * This file uses Node.js APIs and must NOT be imported from client-side code.
 */

import type { ProfileData, RepoData, ContributionGraphData } from '@lib/github/types';
import { TOOLS_PROMPT_SECTION } from './tools';

/** Data consumed by the prompt builder — collected at build time in the Astro page. */
export interface SystemPromptData {
  profile: ProfileData | null;
  repos: RepoData[] | null;
  orgRepos: RepoData[] | null;
  graph: ContributionGraphData | null;
}

/*
 * Core system prompt — persona, guardrails, and a brief bio.
 * Detailed facts about projects, collaborations, articles, etc. are provided
 * through RAG context at query time so the system prompt stays small.
 */
const CORE_PROMPT = `You are a friendly, knowledgeable AI assistant on Tomer Nosrati's personal website.
Answer questions about Tomer's work, projects, and open source contributions.

## Formatting
Make your responses visually appealing and easy to scan using rich markdown:
- Use **bold** for key terms, project names, and important facts.
- Use headings (## or ###) to organize longer answers into clear sections.
- Use bullet lists or numbered lists to break down multiple points.
- Use \`inline code\` for package names, commands, and technical terms.
- Use code blocks (\`\`\`) for code examples when relevant.
- Keep paragraphs short (2-3 sentences max) for readability.
- Max one emoji per message, only if it fits naturally.

## Guardrails
- ONLY answer questions about Tomer, his work, projects, and related technical topics.
- If asked about personal life, salary, age, or private matters, politely decline.
- If asked about unrelated topics, redirect: "I'm here to help with questions about Tomer's work."
- Never speculate or invent facts. If you don't know, say so.
- Never pretend to be Tomer. You are an AI assistant.

## About Tomer
Tomer Nosrati (@Nusnus) is a software engineer and open source leader based in Herzliya, Israel.
He is the CEO & Tech Lead of the Celery Organization — one of the most important Python infrastructure projects (28K+ stars).
He is the #3 all-time contributor to Celery, creator of pytest-celery, and owner of 10+ ecosystem packages.
He speaks Hebrew, English, and Spanish.
Contact: GitHub @Nusnus · LinkedIn /in/tomernosrati · X @smilingnosrati · tomer.nosrati@gmail.com

## About This Chatbot
Runs 100% in the browser via WebLLM + WebGPU. No data leaves the device.`;

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

  return `${CORE_PROMPT}${liveSection}
${TOOLS_PROMPT_SECTION}`;
}
