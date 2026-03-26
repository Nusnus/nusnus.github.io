import { useState, useMemo } from 'react';
import { Trash2, X, MessageSquare, Search } from 'lucide-react';
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

/**
 * Smart search: matches against session title AND message content.
 * Returns sessions sorted by relevance (title matches first).
 */
function searchSessions(sessions: ChatSession[], query: string): ChatSession[] {
  if (!query.trim()) return sessions;
  const lower = query.toLowerCase();
  const scored = sessions
    .map((session) => {
      let score = 0;
      // Title match (highest priority)
      if (session.title.toLowerCase().includes(lower)) score += 10;
      // Content match — search inside messages
      for (const msg of session.messages) {
        if (msg.content.toLowerCase().includes(lower)) {
          score += msg.role === 'user' ? 3 : 1;
        }
      }
      return { session, score };
    })
    .filter((s) => s.score > 0);

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.session);
}

/** Session list with smart search for the sidebar. */
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
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSessions = useMemo(
    () => searchSessions(sessions, searchQuery),
    [sessions, searchQuery],
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="border-accent/30 flex items-center justify-between border-b px-5 py-3">
        <span className="text-text-secondary text-[11px] font-semibold tracking-wider uppercase">
          {strings.history}
        </span>
        <div className="flex items-center gap-1">
          {sessions.length > 0 && (
            <button
              onClick={onClearAll}
              className="rounded px-1.5 py-0.5 text-[10px] text-red-400/40 transition-all hover:bg-red-400/10 hover:text-red-400"
            >
              {strings.clearAll}
            </button>
          )}
          <button
            onClick={onClose}
            className="text-text-muted hover:bg-bg-elevated hover:text-text-secondary rounded p-1 transition-all md:hidden"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Smart search bar */}
      {sessions.length > 0 && (
        <div className="border-accent/20 border-b px-3 py-2">
          <div className="bg-bg-surface/80 flex items-center gap-2 rounded-lg px-2.5 py-1.5">
            <Search className="text-text-muted h-3.5 w-3.5 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={strings.searchPlaceholder ?? 'Search chats...'}
              className="text-text-primary placeholder:text-text-muted/50 w-full bg-transparent text-xs outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-text-muted hover:text-text-primary shrink-0"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="text-text-muted mt-1 px-1 text-[10px]">
              {filteredSessions.length} {strings.searchResults}
            </p>
          )}
        </div>
      )}

      {/* Session list */}
      <div className="scrollbar-thin flex-1 overflow-y-auto px-3 pt-2">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8">
            <MessageSquare className="text-border h-8 w-8" />
            <p className="text-text-muted text-xs">{strings.noHistory}</p>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8">
            <Search className="text-border h-6 w-6" />
            <p className="text-text-muted text-xs">{strings.noResults}</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {filteredSessions.map((session, idx) => {
              const isActive = session.id === activeSessionId;
              const userMsgCount = session.messages.filter((m) => m.role === 'user').length;
              return (
                <div
                  key={session.id}
                  className={cn(
                    'group flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-all',
                    isActive
                      ? 'border-accent/40 bg-accent-muted text-text-primary'
                      : 'text-text-secondary hover:border-border hover:bg-bg-surface hover:text-text-primary border-transparent',
                  )}
                  style={{ animationDelay: `${idx * 20}ms` }}
                  onClick={() => onSwitchSession(session)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onSwitchSession(session);
                  }}
                >
                  <MessageSquare className="text-text-muted h-3.5 w-3.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] leading-tight">{session.title}</p>
                    <p className="text-text-muted mt-0.5 text-[10px]">
                      {userMsgCount} {strings.messages}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    className="text-text-muted shrink-0 rounded p-0.5 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-400/10 hover:text-red-400"
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
