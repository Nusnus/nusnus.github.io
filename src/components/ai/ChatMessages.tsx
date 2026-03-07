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
      <div className="cybernus-shimmer h-3 w-3/4 rounded bg-[#00ff41]/5" />
      <div className="cybernus-shimmer h-3 w-1/2 rounded bg-[#00ff41]/5 [animation-delay:200ms]" />
      <div className="cybernus-shimmer h-3 w-2/3 rounded bg-[#00ff41]/5 [animation-delay:400ms]" />
    </div>
  );
}

/** Animated typing indicator dots. */
function TypingIndicator() {
  return (
    <span className="inline-flex items-center gap-1.5 py-1">
      <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-400/70 [animation-delay:0ms]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-400/60 [animation-delay:150ms]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-400/50 [animation-delay:300ms]" />
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
        isSearching ? 'text-cyan-400/80' : 'text-[#00ff41]/80',
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
              isSearching ? 'animate-bounce bg-cyan-400/60' : 'animate-pulse bg-[#00ff41]/60',
            )}
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </span>
    </span>
  );
}

/** Renders the scrollable message list with modern 2026 UI — full-width. */
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
    <div className="cybernus-scrollbar flex-1 overflow-y-auto px-4 py-6 md:px-8 lg:px-12" dir={dir}>
      <div className="mx-auto max-w-4xl space-y-5">
        {messages.map((msg, msgIndex) => {
          const isUser = msg.role === 'user';
          const isLastAssistant = !isUser && msgIndex === messages.length - 1;
          const isStreaming = isGenerating && isLastAssistant;

          return (
            <div
              key={msg.id}
              className={cn(
                'cybernus-fade-in-up flex gap-4',
                isUser ? 'flex-row-reverse' : 'flex-row',
              )}
              style={{ animationDelay: `${Math.min(msgIndex * 50, 300)}ms` }}
            >
              {/* Avatar */}
              <div className="relative shrink-0 pt-1">
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold transition-all',
                    isUser
                      ? 'bg-[#00ff41]/15 text-[#00ff41] shadow-[0_0_12px_rgba(0,255,65,0.15)]'
                      : 'bg-cyan-500/10 text-cyan-400 shadow-[0_0_12px_rgba(0,200,255,0.1)]',
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
                  <div className="cybernus-glow-pulse absolute -inset-1 rounded-xl border border-cyan-400/20" />
                )}
              </div>

              {/* Message content */}
              <div
                className={cn(
                  'group relative max-w-[85%] min-w-0 rounded-2xl px-5 py-3.5 text-sm leading-relaxed transition-all lg:max-w-[75%]',
                  isUser
                    ? 'rounded-tr-md border border-[#00ff41]/20 bg-[#00ff41]/10 text-[#00ff41]'
                    : 'rounded-tl-md border border-cyan-500/8 bg-black/30 text-gray-200',
                  isStreaming && 'border-cyan-400/15',
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
                  <div className="relative z-10 mt-3 flex flex-wrap gap-2 border-t border-[#00ff41]/10 pt-3">
                    {msg.actions.map((action, idx) => (
                      <button
                        key={idx}
                        onClick={() => executeAction(action)}
                        title={action.url}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#00ff41]/20 px-3 py-1.5 text-xs font-medium text-[#00ff41] transition-all hover:border-[#00ff41]/40 hover:bg-[#00ff41]/10 hover:shadow-[0_0_12px_rgba(0,255,65,0.15)]"
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
                className="group rounded-xl border border-[#00ff41]/12 bg-black/20 px-4 py-3.5 text-left text-xs leading-relaxed text-[#00ff41]/60 transition-all hover:border-[#00ff41]/30 hover:bg-[#00ff41]/5 hover:text-[#00ff41] hover:shadow-[0_0_20px_rgba(0,255,65,0.05)]"
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
