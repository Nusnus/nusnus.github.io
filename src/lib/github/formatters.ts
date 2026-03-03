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
 * Returns a Lucide icon name for a GitHub event type.
 */
export function getEventIcon(type: string): string {
  const map: Record<string, string> = {
    PushEvent: 'git-commit-horizontal',
    PullRequestEvent: 'git-pull-request',
    PullRequestReviewEvent: 'check-circle',
    IssueCommentEvent: 'message-square',
    CreateEvent: 'plus-circle',
    DeleteEvent: 'trash-2',
    IssuesEvent: 'circle-dot',
    ForkEvent: 'git-fork',
    ReleaseEvent: 'tag',
  };
  return map[type] ?? 'activity';
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

/**
 * Extracts the short repo name from a full name (e.g. "celery/celery" → "celery").
 */
export function formatRepoName(fullName: string): string {
  return fullName.split('/').pop() ?? fullName;
}

/**
 * Maps a contribution count to a 0–4 activity level for the heatmap.
 */
export function getActivityLevel(count: number): number {
  if (count === 0) return 0;
  if (count <= 3) return 1;
  if (count <= 6) return 2;
  if (count <= 10) return 3;
  return 4;
}
