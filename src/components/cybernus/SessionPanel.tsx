/**
 * SessionPanel — session history sidebar.
 *
 * Lists all saved chat sessions, newest first. Click to switch,
 * hover-delete on desktop, swipe-delete would be nice but is deferred
 * (mobile gets a visible trash icon instead).
 *
 * The panel itself is dumb — session state lives in the parent. This
 * just renders the list and emits events.
 */

import { memo } from 'react';

import type { ChatSession } from '@lib/ai/memory';
import { cn } from '@lib/utils/cn';

interface SessionPanelProps {
  sessions: readonly ChatSession[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onClearAll: () => void;
}

/** Format a Unix timestamp as a short relative string. */
function relTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'now';
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d`;
  return new Date(ts).toLocaleDateString();
}

export const SessionPanel = memo(function SessionPanel({
  sessions,
  activeId,
  onSelect,
  onDelete,
  onNew,
  onClearAll,
}: SessionPanelProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-border flex items-center justify-between border-b px-3 py-2.5">
        <h2 className="text-text-secondary font-mono text-xs tracking-wider uppercase">Sessions</h2>
        <button
          type="button"
          onClick={onNew}
          aria-label="New chat"
          className="text-accent hover:bg-accent/10 rounded px-2 py-0.5 font-mono text-xs transition-colors"
        >
          + New
        </button>
      </div>

      {/* Session list */}
      <div className="scrollbar-thin flex-1 overflow-y-auto p-2">
        {sessions.length === 0 ? (
          <p className="text-text-muted px-2 py-4 text-center text-xs">No sessions yet.</p>
        ) : (
          <ul className="space-y-1">
            {sessions.map((s) => {
              const isActive = s.id === activeId;
              return (
                <li key={s.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onSelect(s.id)}
                    className={cn(
                      'w-full rounded-lg px-3 py-2 text-left transition-colors',
                      isActive
                        ? 'bg-accent/15 border-accent/30 border'
                        : 'hover:bg-bg-elevated border border-transparent',
                    )}
                  >
                    <div className="text-text-primary truncate pr-6 text-xs">{s.title}</div>
                    <div className="text-text-muted font-mono text-[10px]">
                      {relTime(s.updatedAt)} · {s.messages.length} msg
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(s.id);
                    }}
                    aria-label={`Delete session: ${s.title}`}
                    className="text-text-muted hover:text-status-warning absolute top-1/2 right-2 -translate-y-1/2 p-1 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 md:opacity-0"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-3.5 w-3.5"
                      aria-hidden="true"
                    >
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer */}
      {sessions.length > 0 && (
        <div className="border-border border-t p-2">
          <button
            type="button"
            onClick={onClearAll}
            className="text-text-muted hover:text-status-warning w-full py-1.5 font-mono text-[10px] transition-colors"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
});
