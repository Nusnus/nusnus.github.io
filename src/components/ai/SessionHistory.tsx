/**
 * Session history — persistent left rail on desktop, slide-over on mobile.
 *
 * Two render modes via the `variant` prop:
 *   - rail:    always visible, no close button
 *   - overlay: absolute-positioned with backdrop, close button
 */

import { Trash2, X, MessageSquare, Plus } from 'lucide-react';
import { cn } from '@lib/utils/cn';
import type { ChatSession } from '@lib/ai/memory';

interface SessionHistoryProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSwitchSession: (session: ChatSession) => void;
  onDeleteSession: (sessionId: string) => void;
  onNewChat: () => void;
  onClearAll: () => void;
  /** overlay variant only */
  onClose?: () => void;
  variant: 'rail' | 'overlay';
}

export function SessionHistory({
  sessions,
  activeSessionId,
  onSwitchSession,
  onDeleteSession,
  onNewChat,
  onClearAll,
  onClose,
  variant,
}: SessionHistoryProps) {
  return (
    <div
      className={cn(
        'flex h-full flex-col',
        variant === 'overlay' && 'bg-bg-base border-border absolute inset-0 z-20 border-r',
      )}
    >
      {/* Header */}
      <div className="border-border flex items-center justify-between border-b px-3 py-2.5">
        <button
          onClick={onNewChat}
          className="text-text-primary hover:bg-bg-elevated flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold transition-colors"
        >
          <Plus className="size-4" />
          New Chat
        </button>
        <div className="flex items-center gap-2">
          {sessions.length > 0 && (
            <button
              onClick={onClearAll}
              className="text-text-muted text-xs transition-colors hover:text-red-400"
              title="Delete all sessions"
            >
              Clear
            </button>
          )}
          {variant === 'overlay' && onClose && (
            <button
              onClick={onClose}
              className="text-text-muted hover:text-text-primary transition-colors"
              aria-label="Close history"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Session list */}
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <p className="text-text-muted px-4 py-8 text-center text-xs">No history yet.</p>
        ) : (
          <div className="space-y-0.5 p-2">
            {sessions.map((session) => {
              const isActive = session.id === activeSessionId;
              const msgCount = session.messages.filter((m) => m.role === 'user').length;
              return (
                <div
                  key={session.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSwitchSession(session)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onSwitchSession(session);
                  }}
                  className={cn(
                    'group flex cursor-pointer items-start gap-2 rounded-lg px-2.5 py-2 transition-colors',
                    isActive
                      ? 'bg-accent/10 text-text-primary'
                      : 'hover:bg-bg-surface text-text-secondary',
                  )}
                >
                  <MessageSquare
                    className={cn('mt-0.5 size-3.5 shrink-0', isActive && 'text-accent')}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{session.title}</p>
                    <p className="text-text-muted text-[10px]">
                      {msgCount} msg · {new Date(session.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    className="text-text-muted shrink-0 opacity-0 transition-all group-hover:opacity-100 hover:text-red-400"
                    aria-label="Delete session"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
