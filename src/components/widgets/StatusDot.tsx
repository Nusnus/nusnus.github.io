import { useMemo } from 'react';

interface Props {
  lastEventTimestamp: string;
}

export default function StatusDot({ lastEventTimestamp }: Props) {
  const status = useMemo(() => {
    const eventDate = new Date(lastEventTimestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (eventDate >= today) return 'active';
    if (eventDate >= yesterday) return 'recent';
    return 'inactive';
  }, [lastEventTimestamp]);

  const colorClass = {
    active: 'bg-status-active',
    recent: 'bg-status-warning',
    inactive: 'bg-status-inactive',
  }[status];

  const statusText = {
    active: 'Active today',
    recent: 'Active yesterday',
    inactive: 'Away',
  }[status];

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
      <span className="sr-only">{statusText}</span>
    </span>
  );
}
