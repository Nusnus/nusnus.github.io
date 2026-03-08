import { Trash2, X, MessageSquare } from 'lucide-react';
import { cn } from '@lib/utils/cn';
import type { ChatSession } from '@lib/ai/memory';
import type { Language } from '@lib/ai/i18n';
import { t } from '@lib/ai/i18n';

interface SessionHistoryProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSwitchSession: (session: ChatSession) => void;
  onDeleteSession: (sessionId: string) => void;
  onClearAll: () => void;
  onClose: () => void;
  language: Language;
}

/** Session list for the sidebar. */
export function SessionHistory({
  sessions,
  activeSessionId,
  onSwitchSession,
  onDeleteSession,
  onClearAll,
  onClose,
  language,
}: SessionHistoryProps) {
  const strings = t(language);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <span className="text-[11px] font-medium tracking-wider text-white/25 uppercase">
          {strings.history}
        </span>
        <div className="flex items-center gap-1">
          {sessions.length > 0 && (
            <button
              onClick={onClearAll}
              className="rounded px-1.5 py-0.5 text-[10px] text-red-400/30 transition-all hover:bg-red-400/10 hover:text-red-400"
            >
              {strings.clearAll}
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded p-1 text-white/30 transition-all hover:bg-white/[0.05] hover:text-white/60 md:hidden"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Session list */}
      <div className="scrollbar-thin flex-1 overflow-y-auto px-2">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8">
            <MessageSquare className="h-8 w-8 text-white/10" />
            <p className="text-xs text-white/20">{strings.noHistory}</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {sessions.map((session, idx) => {
              const isActive = session.id === activeSessionId;
              const userMsgCount = session.messages.filter((m) => m.role === 'user').length;
              return (
                <div
                  key={session.id}
                  className={cn(
                    'group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 transition-all',
                    isActive
                      ? 'bg-emerald-500/[0.08] text-white ring-1 ring-emerald-500/20'
                      : 'text-white/50 hover:bg-white/[0.04] hover:text-white/80',
                  )}
                  style={{ animationDelay: `${idx * 20}ms` }}
                  onClick={() => onSwitchSession(session)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onSwitchSession(session);
                  }}
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 text-white/20" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] leading-tight">{session.title}</p>
                    <p className="mt-0.5 text-[10px] text-white/20">
                      {userMsgCount} {strings.messages}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    className="shrink-0 rounded p-0.5 text-white/20 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-400/10 hover:text-red-400"
                    aria-label="Delete session"
                  >
                    <Trash2 className="h-3 w-3" />
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
