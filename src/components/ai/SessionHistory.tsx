import { Trash2, X, MessageSquare } from 'lucide-react';
import { cn } from '@lib/utils/cn';
import type { ChatSession } from '@lib/ai/memory';

interface SessionHistoryProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSwitchSession: (session: ChatSession) => void;
  onDeleteSession: (sessionId: string) => void;
  onClearAll: () => void;
  onClose: () => void;
}

/** Sidebar session history panel — professional design with design tokens. */
export function SessionHistory({
  sessions,
  activeSessionId,
  onSwitchSession,
  onDeleteSession,
  onClearAll,
  onClose,
}: SessionHistoryProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="border-border flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="text-text-muted h-4 w-4" />
          <h3 className="text-text-primary text-sm font-semibold">Chat History</h3>
          <span className="bg-bg-elevated text-text-muted rounded-full px-2 py-0.5 text-[10px]">
            {sessions.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {sessions.length > 0 && (
            <button
              onClick={onClearAll}
              className="rounded-lg px-2 py-1 text-xs text-red-400/50 transition-all hover:bg-red-400/10 hover:text-red-400"
            >
              Clear All
            </button>
          )}
          <button
            onClick={onClose}
            className="text-text-muted hover:bg-bg-elevated hover:text-text-secondary rounded-lg p-1 transition-all md:hidden"
            aria-label="Close history"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Session list */}
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <p className="text-text-muted px-4 py-8 text-center text-sm">No chat history yet.</p>
        ) : (
          <div className="divide-border divide-y">
            {sessions.map((session, idx) => {
              const isActive = session.id === activeSessionId;
              const userMsgCount = session.messages.filter((m) => m.role === 'user').length;
              return (
                <div
                  key={session.id}
                  className={cn(
                    'cybernus-fade-in-up group flex cursor-pointer items-start justify-between gap-3 px-4 py-3 transition-all',
                    isActive
                      ? 'border-l-accent bg-accent-muted border-l-2'
                      : 'hover:bg-bg-elevated border-l-2 border-l-transparent',
                  )}
                  style={{ animationDelay: `${idx * 30}ms` }}
                  onClick={() => onSwitchSession(session)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onSwitchSession(session);
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'truncate text-sm font-medium',
                        isActive ? 'text-text-primary' : 'text-text-secondary',
                      )}
                    >
                      {session.title}
                    </p>
                    <p className="text-text-muted mt-0.5 text-[11px]">
                      {userMsgCount} messages · {new Date(session.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    className="text-text-muted shrink-0 rounded-lg p-1 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-400/10 hover:text-red-400"
                    aria-label="Delete session"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
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
