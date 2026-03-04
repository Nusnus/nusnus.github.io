import { useState, useEffect } from 'react';
import type { ActivityEvent } from '@lib/github/types';
import { fetchEvents } from '@lib/github/api';
import { formatEventType, getEventColor, truncateCommitMessage } from '@lib/github/formatters';
import { relativeTime } from '@lib/utils/date';
import { isKnownPublicRepo } from '@config';
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

function processRawEvents(
  raw: {
    type?: string;
    repo: { name: string };
    created_at?: string;
    id: string;
    payload?: Record<string, unknown>;
  }[],
): ActivityEvent[] {
  return raw.slice(0, 20).map((e) => {
    const payload = e.payload ?? {};
    let title = e.type?.replace('Event', '') ?? 'Activity';
    const url = `https://github.com/${e.repo.name}`;

    if (e.type === 'PushEvent') {
      const commits = (payload.commits as { message: string }[]) ?? [];
      title = commits[0]?.message ?? 'Push';
    } else if (e.type === 'PullRequestEvent') {
      const pr = payload.pull_request as { title: string } | undefined;
      title = pr?.title ?? 'Pull Request';
    }

    const repoName = e.repo.name;
    return {
      id: e.id,
      type: e.type ?? 'Unknown',
      repo: isKnownPublicRepo(repoName) ? repoName : 'Private Project',
      title: isKnownPublicRepo(repoName) ? title : (e.type?.replace('Event', '') ?? 'Activity'),
      url: isKnownPublicRepo(repoName) ? url : `https://github.com/${repoName.split('/')[0]}`,
      createdAt: e.created_at ?? new Date().toISOString(),
    };
  });
}

export default function ActivityFeed({ initialEvents }: Props) {
  const [events, setEvents] = useState<ActivityEvent[]>(initialEvents);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetchEvents()
      .then((raw) => {
        if (cancelled || !raw) return;
        const processed = processRawEvents(
          raw as unknown as {
            type?: string;
            repo: { name: string };
            created_at?: string;
            id: string;
            payload?: Record<string, unknown>;
          }[],
        );
        if (processed.length > 0) setEvents(processed);
      })
      .catch(() => {
        // Fallback to initial events — already set
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading && events.length === 0) {
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
            className="group hover:bg-bg-surface flex gap-3 rounded-lg p-2.5 transition-colors duration-100 motion-reduce:transition-none"
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
