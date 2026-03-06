/**
 * SessionHistory — Sliding overlay panel for previous chat sessions.
 */
import { Trash2, X } from 'lucide-react';
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

/** Sliding overlay panel that lists previous chat sessions. */
export function SessionHistory({
  sessions,
  activeSessionId,
  onSwitchSession,
  onDeleteSession,
  onClearAll,
  onClose,
}: SessionHistoryProps) {
  return (
    <div className="animate-in fade-in slide-in-from-right-2 absolute inset-0 z-10 flex flex-col overflow-hidden bg-[#0b0d14]/95 backdrop-blur-xl duration-200">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
        <h3 className="text-sm font-semibold text-gray-200">Chat History</h3>
        <div className="flex items-center gap-2">
          {sessions.length > 0 && (
            <button
              onClick={onClearAll}
              className="text-xs text-gray-500 transition-colors hover:text-red-400"
            >
              Clear All
            </button>
          )}
          <button
            onClick={onClose}
            className="text-gray-500 transition-colors hover:text-gray-300"
            aria-label="Close history"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-500">No chat history yet.</p>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={cn(
                  'group flex cursor-pointer items-start justify-between gap-2 px-4 py-3 transition-all',
                  session.id === activeSessionId ? 'bg-cyan-500/10' : 'hover:bg-white/[0.03]',
                )}
                onClick={() => onSwitchSession(session)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSwitchSession(session);
                }}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-200">{session.title}</p>
                  <p className="text-xs text-gray-500">
                    {session.messages.filter((m) => m.role === 'user').length} messages
                    {' · '}
                    {new Date(session.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(session.id);
                  }}
                  className="shrink-0 text-gray-600 opacity-0 transition-all group-hover:opacity-100 hover:text-red-400"
                  aria-label="Delete session"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
