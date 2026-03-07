import { type RefObject, useMemo } from 'react';
import { ArrowRight, ExternalLink, Globe } from 'lucide-react';
import { cn } from '@lib/utils/cn';
import { SUGGESTED_QUESTIONS } from '@lib/ai/config';
import type { ChatMessage } from '@lib/ai/types';
import { renderMarkdown } from '@lib/ai/markdown';
import { executeAction } from '@lib/ai/tools';
import type { Language } from '@lib/ai/i18n';
import { t } from '@lib/ai/i18n';

interface ChatMessagesProps {
  messages: ChatMessage[];
  isGenerating: boolean;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onSendMessage: (text: string) => void;
  language: Language;
}

/** Skeleton loading shimmer for streaming messages. */
function SkeletonLoader() {
  return (
    <div className="space-y-2.5 py-1">
      <div className="cybernus-shimmer bg-bg-elevated h-3 w-3/4 rounded" />
      <div className="cybernus-shimmer bg-bg-elevated h-3 w-1/2 rounded [animation-delay:200ms]" />
      <div className="cybernus-shimmer bg-bg-elevated h-3 w-2/3 rounded [animation-delay:400ms]" />
    </div>
  );
}

/** Animated typing indicator dots. */
function TypingIndicator() {
  return (
    <span className="inline-flex items-center gap-1.5 py-1">
      <span className="bg-accent/70 h-2 w-2 animate-bounce rounded-full [animation-delay:0ms]" />
      <span className="bg-accent/60 h-2 w-2 animate-bounce rounded-full [animation-delay:150ms]" />
      <span className="bg-accent/50 h-2 w-2 animate-bounce rounded-full [animation-delay:300ms]" />
    </span>
  );
}

/** Web search status indicator. */
function SearchIndicator({
  status,
  strings,
}: {
  status: 'searching' | 'found';
  strings: ReturnType<typeof t>;
}) {
  const isSearching = status === 'searching';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 text-xs',
        isSearching ? 'text-text-secondary' : 'text-accent',
      )}
    >
      <Globe className={cn('h-4 w-4', isSearching && 'animate-spin')} />
      <span>{isSearching ? strings.searchingWeb : strings.foundResults}</span>
      <span className="inline-flex gap-0.5">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className={cn(
              'inline-block h-1.5 w-1.5 rounded-full',
              isSearching ? 'bg-text-secondary animate-bounce' : 'bg-accent/60 animate-pulse',
            )}
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </span>
    </span>
  );
}

/** Renders the scrollable message list — professional wide-screen layout. */
export function ChatMessages({
  messages,
  isGenerating,
  messagesEndRef,
  onSendMessage,
  language,
}: ChatMessagesProps) {
  const strings = t(language);
  const dir = language === 'he' ? 'rtl' : 'ltr';

  const isWelcomeOnly = useMemo(
    () => messages.length === 1 && messages[0]?.role === 'assistant',
    [messages],
  );

  return (
    <div className="scrollbar-thin flex-1 overflow-y-auto px-4 py-6 md:px-8 lg:px-12" dir={dir}>
      <div className="mx-auto max-w-4xl space-y-5">
        {messages.map((msg, msgIndex) => {
          const isUser = msg.role === 'user';
          const isLastAssistant = !isUser && msgIndex === messages.length - 1;
          const isStreaming = isGenerating && isLastAssistant;

          return (
            <div
              key={msg.id}
              className={cn(
                'cybernus-fade-in-up flex gap-3',
                isUser ? 'flex-row-reverse' : 'flex-row',
              )}
              style={{ animationDelay: `${Math.min(msgIndex * 50, 300)}ms` }}
            >
              {/* Avatar */}
              <div className="relative shrink-0 pt-1">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition-all',
                    isUser ? 'bg-accent-muted text-accent' : 'bg-bg-elevated text-text-secondary',
                  )}
                >
                  {isUser ? (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                  ) : (
                    <span className="text-[10px] font-black tracking-widest">CN</span>
                  )}
                </div>
                {isStreaming && (
                  <div className="cybernus-glow-pulse border-accent/20 absolute -inset-0.5 rounded-lg border" />
                )}
              </div>

              {/* Message content */}
              <div
                className={cn(
                  'group relative max-w-[85%] min-w-0 rounded-2xl px-4 py-3 text-sm leading-relaxed transition-all lg:max-w-[75%]',
                  isUser
                    ? 'border-accent/20 bg-accent-muted text-text-primary rounded-tr-md border'
                    : 'border-border bg-bg-surface text-text-primary rounded-tl-md border',
                  isStreaming && 'border-accent/15',
                )}
              >
                {/* Scan-line effect on streaming assistant messages */}
                {!isUser && isStreaming && <div className="cybernus-scan-line rounded-2xl" />}

                <div className="relative z-10">
                  {msg.searchStatus ? (
                    <SearchIndicator status={msg.searchStatus} strings={strings} />
                  ) : !msg.content ? (
                    isStreaming ? (
                      <SkeletonLoader />
                    ) : (
                      <TypingIndicator />
                    )
                  ) : !isUser ? (
                    renderMarkdown(msg.content, isStreaming)
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}

                  {isStreaming && msg.content && <span className="typing-cursor" />}
                </div>

                {/* Tool action buttons */}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="border-border relative z-10 mt-3 flex flex-wrap gap-2 border-t pt-3">
                    {msg.actions.map((action, idx) => (
                      <button
                        key={idx}
                        onClick={() => executeAction(action)}
                        title={action.url}
                        className="border-border text-accent hover:border-accent/40 hover:bg-accent-muted inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all"
                      >
                        {action.type === 'open_link' ? (
                          <ExternalLink className="h-3 w-3" />
                        ) : (
                          <ArrowRight className="h-3 w-3" />
                        )}
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Suggested questions — shown after welcome message only */}
        {isWelcomeOnly && (
          <div
            className="cybernus-fade-in-up mx-auto grid max-w-2xl gap-2.5 pt-4 sm:grid-cols-2"
            style={{ animationDelay: '200ms' }}
          >
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => onSendMessage(q)}
                disabled={isGenerating}
                className="group border-border bg-bg-surface text-text-secondary hover:border-accent/30 hover:bg-accent-muted hover:text-text-primary rounded-xl border px-4 py-3.5 text-left text-xs leading-relaxed transition-all"
              >
                <span className="opacity-70 transition-opacity group-hover:opacity-100">{q}</span>
              </button>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
