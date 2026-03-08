import { type RefObject, useMemo } from 'react';
import { ArrowRight, ExternalLink, Globe, Sparkles } from 'lucide-react';
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
    <div className="space-y-2 py-1">
      <div className="cybernus-shimmer bg-bg-elevated h-3.5 w-4/5 rounded" />
      <div className="cybernus-shimmer bg-bg-elevated h-3.5 w-3/5 rounded [animation-delay:200ms]" />
      <div className="cybernus-shimmer bg-bg-elevated h-3.5 w-2/3 rounded [animation-delay:400ms]" />
    </div>
  );
}

/** Animated typing indicator dots. */
function TypingIndicator() {
  return (
    <span className="inline-flex items-center gap-1 py-1">
      <span className="bg-accent/60 h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:0ms]" />
      <span className="bg-accent/50 h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:150ms]" />
      <span className="bg-accent/40 h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:300ms]" />
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
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs',
        isSearching ? 'bg-bg-elevated text-text-secondary' : 'bg-accent-muted text-accent',
      )}
    >
      <Globe className={cn('h-3.5 w-3.5', isSearching && 'animate-spin')} />
      <span>{isSearching ? strings.searchingWeb : strings.foundResults}</span>
      {isSearching && (
        <span className="inline-flex gap-0.5">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="bg-text-muted inline-block h-1 w-1 animate-bounce rounded-full"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </span>
      )}
    </div>
  );
}

/** Renders the scrollable message list — ChatGPT-style full-width layout. */
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
    <div className="scrollbar-thin flex-1 overflow-y-auto" dir={dir}>
      {messages.map((msg, msgIndex) => {
        const isUser = msg.role === 'user';
        const isLastAssistant = !isUser && msgIndex === messages.length - 1;
        const isStreaming = isGenerating && isLastAssistant;

        return (
          <div
            key={msg.id}
            className={cn('group px-4 py-5 md:px-6 lg:px-8', isUser && 'bg-bg-surface/40')}
          >
            <div className="mx-auto flex max-w-3xl gap-4">
              {/* Avatar */}
              <div className="relative shrink-0 pt-0.5">
                <div
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full',
                    isUser
                      ? 'bg-accent/15 text-accent'
                      : 'border-accent/20 bg-bg-base text-accent border',
                  )}
                >
                  {isUser ? (
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                </div>
                {isStreaming && (
                  <div className="cybernus-glow-pulse border-accent/30 absolute -inset-0.5 rounded-full border" />
                )}
              </div>

              {/* Message body */}
              <div className="min-w-0 flex-1">
                {/* Role label */}
                <p
                  className={cn(
                    'mb-1.5 text-xs font-semibold',
                    isUser ? 'text-text-secondary' : 'text-accent',
                  )}
                >
                  {isUser ? 'You' : 'Cybernus'}
                </p>

                {/* Content */}
                <div className="text-text-primary text-sm leading-relaxed">
                  {msg.searchStatus ? (
                    <SearchIndicator status={msg.searchStatus} strings={strings} />
                  ) : !msg.content ? (
                    isStreaming ? (
                      <SkeletonLoader />
                    ) : (
                      <TypingIndicator />
                    )
                  ) : !isUser ? (
                    <div className="relative">
                      {renderMarkdown(msg.content, isStreaming)}
                      {isStreaming && msg.content && <span className="typing-cursor" />}
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>

                {/* Tool action buttons */}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
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
          </div>
        );
      })}

      {/* Suggested questions — shown after welcome message only */}
      {isWelcomeOnly && (
        <div className="px-4 py-2 md:px-6 lg:px-8">
          <div
            className="cybernus-fade-in-up mx-auto grid max-w-3xl gap-2 sm:grid-cols-2"
            style={{ animationDelay: '200ms' }}
          >
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => onSendMessage(q)}
                disabled={isGenerating}
                className="group border-border text-text-secondary hover:border-accent/30 hover:text-text-primary rounded-xl border bg-transparent px-4 py-3 text-left text-[13px] leading-relaxed transition-all hover:bg-white/[0.02]"
              >
                <span className="opacity-60 transition-opacity group-hover:opacity-100">{q}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div ref={messagesEndRef} className="h-4" />
    </div>
  );
}
