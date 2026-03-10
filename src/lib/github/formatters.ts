/**
 * Maps GitHub event types to human-readable display strings.
 */
export function formatEventType(type: string): string {
  const map: Record<string, string> = {
    PushEvent: 'Pushed',
    PullRequestEvent: 'Pull Request',
    PullRequestReviewEvent: 'Reviewed',
    IssueCommentEvent: 'Commented',
    CreateEvent: 'Created',
    DeleteEvent: 'Deleted',
    IssuesEvent: 'Issue',
    ForkEvent: 'Forked',
    WatchEvent: 'Starred',
    ReleaseEvent: 'Released',
  };
  return map[type] ?? type.replace('Event', '');
}

/**
 * Returns a Tailwind color class for a GitHub event type.
 */
export function getEventColor(type: string): string {
  const map: Record<string, string> = {
    PushEvent: 'text-accent',
    PullRequestEvent: 'text-status-active',
    PullRequestReviewEvent: 'text-blue-400',
    IssueCommentEvent: 'text-purple-400',
    CreateEvent: 'text-status-active',
    DeleteEvent: 'text-red-400',
    IssuesEvent: 'text-orange-400',
    ReleaseEvent: 'text-accent',
  };
  return map[type] ?? 'text-text-secondary';
}

/**
 * Truncates a commit message to a maximum length.
 */
export function truncateCommitMessage(message: string, maxLen = 72): string {
  const firstLine = message.split('\n')[0] ?? message;
  if (firstLine.length <= maxLen) return firstLine;
  return `${firstLine.slice(0, maxLen - 1)}…`;
}

/** Heatmap activity level thresholds (contribution counts). */
const ACTIVITY_THRESHOLD_LOW = 3;
const ACTIVITY_THRESHOLD_MED = 6;
const ACTIVITY_THRESHOLD_HIGH = 10;

/**
 * Maps a contribution count to a 0–4 activity level for the heatmap.
 */
export function getActivityLevel(count: number): number {
  if (count === 0) return 0;
  if (count <= ACTIVITY_THRESHOLD_LOW) return 1;
  if (count <= ACTIVITY_THRESHOLD_MED) return 2;
  if (count <= ACTIVITY_THRESHOLD_HIGH) return 3;
  return 4;
}
