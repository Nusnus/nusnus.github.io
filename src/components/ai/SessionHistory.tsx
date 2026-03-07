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

/** Sliding overlay panel — Matrix-styled session history. */
export function SessionHistory({
  sessions,
  activeSessionId,
  onSwitchSession,
  onDeleteSession,
  onClearAll,
  onClose,
}: SessionHistoryProps) {
  return (
    <div className="cybernus-fade-in absolute inset-0 z-10 flex flex-col overflow-hidden border-r border-[#00ff41]/10 bg-black/95 backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#00ff41]/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-[#00ff41]/60" />
          <h3 className="text-sm font-semibold tracking-wide text-[#00ff41]">Chat History</h3>
          <span className="rounded-full bg-[#00ff41]/10 px-2 py-0.5 text-[10px] text-[#00ff41]/50">
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
            className="rounded-lg p-1 text-[#00ff41]/30 transition-all hover:bg-[#00ff41]/10 hover:text-[#00ff41]/60"
            aria-label="Close history"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Session list */}
      <div className="cybernus-scrollbar flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[#00ff41]/25">No chat history yet.</p>
        ) : (
          <div className="divide-y divide-[#00ff41]/5">
            {sessions.map((session, idx) => {
              const isActive = session.id === activeSessionId;
              const userMsgCount = session.messages.filter((m) => m.role === 'user').length;
              return (
                <div
                  key={session.id}
                  className={cn(
                    'cybernus-fade-in-up group flex cursor-pointer items-start justify-between gap-3 px-4 py-3 transition-all',
                    isActive
                      ? 'border-l-2 border-l-[#00ff41] bg-[#00ff41]/5'
                      : 'border-l-2 border-l-transparent hover:bg-[#00ff41]/[0.03]',
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
                        isActive ? 'text-[#00ff41]' : 'text-[#00ff41]/70',
                      )}
                    >
                      {session.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#00ff41]/30">
                      {userMsgCount} messages · {new Date(session.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    className="shrink-0 rounded-lg p-1 text-[#00ff41]/15 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-400/10 hover:text-red-400"
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
