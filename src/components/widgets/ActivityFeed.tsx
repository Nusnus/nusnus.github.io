import { useState, useCallback } from 'react';
import type { ActivityEvent, ActivityData } from '@lib/github/types';
import { formatEventType, getEventColor, truncateCommitMessage } from '@lib/github/formatters';
import { relativeTime } from '@lib/utils/date';
import { useLiveData } from '@hooks/useLiveData';
import {
  GitCommitHorizontal,
  GitPullRequest,
  CheckCircle,
  MessageSquare,
  PlusCircle,
  Activity,
} from 'lucide-react';

interface Props {
  initialEvents: ActivityEvent[];
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  PushEvent: GitCommitHorizontal,
  PullRequestEvent: GitPullRequest,
  PullRequestReviewEvent: CheckCircle,
  IssueCommentEvent: MessageSquare,
  CreateEvent: PlusCircle,
};

export default function ActivityFeed({ initialEvents }: Props) {
  const [fallback] = useState<ActivityEvent[]>(initialEvents);

  // The LiveData island is responsible for fetching activity and publishing
  // `live-data:activity`. We just subscribe and re-render whenever a fresh
  // payload arrives — including the synchronous stash on initial mount, so
  // there is no flicker between "static" and "live" data.
  const liveEvents = useLiveData<ActivityData, ActivityEvent[]>(
    'live-data:activity',
    useCallback((data) => data?.events, []),
  );

  const events = liveEvents ?? fallback;

  if (events.length === 0) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="bg-bg-elevated h-16 animate-pulse rounded-lg motion-reduce:animate-none"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1" role="feed" aria-label="Recent GitHub activity">
      {events.map((event, index) => {
        const Icon = ICON_MAP[event.type] ?? Activity;
        const colorClass = getEventColor(event.type);

        return (
          <a
            key={event.id}
            href={event.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group hover:bg-bg-surface active:bg-bg-surface/80 flex gap-3 rounded-lg p-2.5 transition-colors duration-100 motion-reduce:transition-none"
            style={{
              animation: `slide-in-right 200ms ease-out ${index * 50}ms both`,
            }}
          >
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${colorClass}`} />
            <div className="min-w-0 flex-1">
              <p className="text-text-primary group-hover:text-accent truncate text-sm">
                {truncateCommitMessage(event.title)}
              </p>
              <div className="text-text-muted mt-0.5 flex items-center gap-2 text-xs">
                <span className="font-mono">{event.repo.split('/').pop()}</span>
                <span>·</span>
                <span>{formatEventType(event.type)}</span>
                <span>·</span>
                <time dateTime={event.createdAt}>{relativeTime(event.createdAt)}</time>
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
}
