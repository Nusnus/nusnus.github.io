/**
 * System prompt builder (server/build-time only).
 *
 * This file uses Node.js APIs (fs, path) and must NOT be imported from
 * client-side code. It is only used in Astro pages at build time.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ProfileData, RepoData, ContributionGraphData } from '@lib/github/types';
import { TOOLS_PROMPT_SECTION } from './tools';

/** Data consumed by the prompt builder — collected at build time in the Astro page. */
export interface SystemPromptData {
  profile: ProfileData | null;
  repos: RepoData[] | null;
  orgRepos: RepoData[] | null;
  graph: ContributionGraphData | null;
}

/**
 * Build the system prompt from the curated knowledge file + live site data.
 * The knowledge file provides persona, guardrails, and rich context.
 * The live data supplements it with up-to-date numbers.
 */
export function buildSystemPrompt(data: SystemPromptData): string {
  const { profile, repos, orgRepos, graph } = data;
  const fmt = (n: number) => n.toLocaleString('en-US');

  /* ── Read curated knowledge file ── */
  const knowledgePath = join(process.cwd(), 'public', 'data', 'ai-knowledge.md');
  const knowledge = readFileSync(knowledgePath, 'utf-8');

  /* ── Live stats supplement ── */
  const liveStats: string[] = [];

  if (profile) {
    liveStats.push(
      `GitHub followers: ${fmt(profile.followers)}, Public repos: ${profile.publicRepos}`,
    );
  }

  if (repos?.length) {
    liveStats.push('Key project stats (live):');
    for (const r of repos) {
      const rank = r.contributorRank ? `, #${r.contributorRank} contributor` : '';
      liveStats.push(`- ${r.fullName}: ${fmt(r.stars)} stars, ${fmt(r.forks)} forks${rank}`);
    }
  }

  if (orgRepos?.length) {
    liveStats.push('Org repo stats (live):');
    for (const r of orgRepos) {
      liveStats.push(`- ${r.fullName}: ${fmt(r.stars)} stars`);
    }
  }

  if (graph) {
    liveStats.push(
      `Contribution stats (last year): ${fmt(graph.totalContributions)} total, ` +
        `${fmt(graph.totalCommits)} commits, ${fmt(graph.totalPRs)} PRs, ` +
        `${fmt(graph.totalReviews)} reviews, ${fmt(graph.totalIssues)} issues`,
    );
  }

  return `${knowledge}

# Live Data (auto-updated)
${liveStats.join('\n')}
${TOOLS_PROMPT_SECTION}`;
}
