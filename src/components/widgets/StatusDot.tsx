/**
 * StatusDot — small live indicator next to the avatar.
 *
 * Computes "active today / yesterday / away" from the most recent GitHub
 * activity event. Initial state is hydrated from the build-time timestamp
 * (`initialTimestamp`), then live-updates whenever `LiveData` publishes
 * `live-data:activity`.
 */

import { useCallback, useMemo } from 'react';
import type { ActivityData } from '@lib/github/types';
import { useLiveData } from '@hooks/useLiveData';

interface Props {
  initialTimestamp: string;
}

type Status = 'active' | 'recent' | 'inactive';

function computeStatus(timestamp: string): Status {
  const eventDate = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (eventDate >= today) return 'active';
  if (eventDate >= yesterday) return 'recent';
  return 'inactive';
}

const COLOR_CLASS: Record<Status, string> = {
  active: 'bg-status-active',
  recent: 'bg-status-warning',
  inactive: 'bg-status-inactive',
};

const STATUS_TEXT: Record<Status, string> = {
  active: 'Active today',
  recent: 'Active yesterday',
  inactive: 'Away',
};

export default function StatusDot({ initialTimestamp }: Props) {
  const liveTimestamp = useLiveData<ActivityData, string>(
    'live-data:activity',
    useCallback((data) => data?.events?.[0]?.createdAt, []),
  );

  const timestamp = liveTimestamp ?? initialTimestamp;
  const status = useMemo(() => computeStatus(timestamp), [timestamp]);
  const colorClass = COLOR_CLASS[status];
  const shouldPulse = status !== 'inactive';

  return (
    <span className="relative flex h-3.5 w-3.5">
      {shouldPulse && (
        <span
          className={`absolute inline-flex h-full w-full rounded-full opacity-75 motion-reduce:hidden ${colorClass}`}
          style={{ animation: 'pulse-dot 2s ease-in-out infinite' }}
          aria-hidden="true"
        />
      )}
      <span className={`relative inline-flex h-3.5 w-3.5 rounded-full ${colorClass}`} />
      <span className="sr-only">{STATUS_TEXT[status]}</span>
    </span>
  );
}
