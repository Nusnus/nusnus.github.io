import { Trash2, X } from 'lucide-react';
import { cn } from '@lib/utils/cn';
import type { ChatSession } from '@lib/ai/memory';
import { useLanguage } from '@hooks/useLanguage';

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
  const { t } = useLanguage();

  return (
    <div className="border-border bg-bg-base absolute inset-0 z-10 flex flex-col overflow-hidden">
      <div className="border-border flex items-center justify-between border-b px-4 py-2.5">
        <h3 className="text-text-primary text-sm font-semibold">{t('chatHistory')}</h3>
        <div className="flex items-center gap-2">
          {sessions.length > 0 && (
            <button
              onClick={onClearAll}
              className="text-text-muted text-xs transition-colors hover:text-red-400"
            >
              {t('clearAll')}
            </button>
          )}
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors"
            aria-label={t('closeHistory')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <p className="text-text-muted px-4 py-8 text-center text-sm">{t('noChatHistory')}</p>
        ) : (
          <div className="divide-border divide-y">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={cn(
                  'group flex cursor-pointer items-start justify-between gap-2 px-4 py-3 transition-colors',
                  session.id === activeSessionId ? 'bg-accent/10' : 'hover:bg-bg-surface',
                )}
                onClick={() => onSwitchSession(session)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSwitchSession(session);
                }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-text-primary truncate text-sm font-medium">{session.title}</p>
                  <p className="text-text-muted text-xs">
                    {session.messages.filter((m) => m.role === 'user').length} {t('messages')}
                    {' · '}
                    {new Date(session.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(session.id);
                  }}
                  className="text-text-muted shrink-0 opacity-0 transition-all group-hover:opacity-100 hover:text-red-400"
                  aria-label={t('deleteSession')}
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
