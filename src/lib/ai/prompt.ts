/**
 * Build-time system prompt stub.
 *
 * The heavy lifting happens in cloud-context.ts at query time — this just
 * provides a minimal base that's baked into the page. Kept for compatibility
 * with chat.astro's build-time data loading.
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
 * Minimal build-time prompt. The full Cybernus identity + spectrum overlay
 * + live data are injected client-side via buildCloudContext().
 */
export function buildSystemPrompt(data: SystemPromptData): string {
  const { profile, repos, graph } = data;
  const fmt = (n: number) => n.toLocaleString('en-US');

  const stats: string[] = [];
  if (profile)
    stats.push(`${fmt(profile.followers)} GitHub followers, ${profile.publicRepos} repos`);
  if (repos?.length) {
    for (const r of repos.slice(0, 4)) {
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

  const liveSection = stats.length > 0 ? `\n\n## Build-Time Snapshot\n${stats.join(' · ')}` : '';
  return `You are Cybernus — Tomer Nosrati's digital construct on his portfolio site. Full identity, tools, and live data follow in the context below.${liveSection}`;
}
