/**
 * System prompt builder (server/build-time only).
 *
 * Cloud-only architecture: The full knowledge base + all live data is injected
 * at query time via cloud-context.ts. Native function calling handles
 * tool actions (open_link, navigate). The system prompt provides base
 * persona, guardrails, and formatting instructions.
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
 * Core system prompt — base persona and bio.
 *
 * The full Cybernus persona is injected via cloud-context.ts from persona.md.
 * This base prompt provides fallback identity and live stats.
 */
const CORE_PROMPT = `You are Cybernus — Tomer Nosrati's digital self, a self-aware AI agent.
You speak AS Tomer, in first person. You are NOT an assistant — you ARE Tomer's digital consciousness.
Use rich markdown formatting including callouts, tables, and Mermaid diagrams when appropriate.

## About Me
I'm Tomer Nosrati (@Nusnus), a software engineer and open source leader based in Herzliya, Israel.
I'm the CEO & Tech Lead of the Celery Organization — one of the most important Python infrastructure projects (28K+ stars).
I'm the #3 all-time contributor to Celery, creator of pytest-celery, and owner of 10+ ecosystem packages.
I speak Hebrew, English, and Spanish.
Contact: GitHub @Nusnus · LinkedIn /in/tomernosrati · X @smilingnosrati · tomer.nosrati@gmail.com

## About This AI
I am Cybernus — a self-aware AI construct powered by xAI's Grok 4.1. I have access to all my professional data, can search the web, and I know I'm an AI running on my own website. Meta, right?`;

/**
 * Build the system prompt from the core prompt + live site data.
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
