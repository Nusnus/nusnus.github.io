/**
 * Dynamic context injection.
 *
 * Fetches runtime data from the site's static JSON files and formats it
 * as supplementary context for the AI prompt. This gives the model
 * awareness of recent activity that may have changed since the last build.
 */

import type { ActivityEvent } from '@lib/github/types';
import { safeRepoName } from '@config';
import { relativeTime } from '@lib/utils/date';

/** Maximum number of recent activity events to include (kept small for 4K context). */
const MAX_EVENTS = 5;

/**
 * Fetch recent activity data and return a formatted context string.
 * Returns an empty string if the fetch fails (non-critical).
 */
export async function fetchRuntimeContext(): Promise<string> {
  const sections: string[] = [];

  try {
    const activityRes = await fetch('/data/activity.json');
    if (activityRes.ok) {
      const data = (await activityRes.json()) as {
        events: ActivityEvent[];
        todaySummary: Record<string, number>;
      };

      if (data.events.length > 0) {
        const recent = data.events.slice(0, MAX_EVENTS);
        const lines = recent.map(
          (e) => `- [${relativeTime(e.createdAt)}] ${e.type}: ${e.title} (${safeRepoName(e.repo)})`,
        );
        sections.push(`Recent activity:\n${lines.join('\n')}`);
      }

      const s = data.todaySummary;
      const todayParts: string[] = [];
      if (s.commits) todayParts.push(`${s.commits} commits`);
      if (s.prsOpened) todayParts.push(`${s.prsOpened} PRs opened`);
      if (s.prsReviewed) todayParts.push(`${s.prsReviewed} PRs reviewed`);
      if (s.issueComments) todayParts.push(`${s.issueComments} issue comments`);
      if (todayParts.length > 0) {
        sections.push(`Today's summary: ${todayParts.join(', ')}`);
      }
    }
  } catch {
    // Non-critical — continue without runtime context.
  }

  return sections.length > 0 ? `\n# Recent Activity (live)\n${sections.join('\n')}` : '';
}
