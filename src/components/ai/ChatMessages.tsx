import { type RefObject, useMemo, useCallback } from 'react';
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

/**
 * Extract follow-up suggestions (lines starting with "→ ") from the end
 * of an assistant message. Returns the main content and suggestion strings.
 */
function extractFollowUps(content: string): { body: string; suggestions: string[] } {
  const lines = content.split('\n');
  const suggestions: string[] = [];

  // Walk backwards collecting → lines
  let i = lines.length - 1;
  while (i >= 0) {
    const line = (lines[i] ?? '').trim();
    if (line.startsWith('→ ')) {
      suggestions.unshift(line.slice(2).trim());
      i--;
    } else if (line === '') {
      // skip trailing blank lines between content and suggestions
      i--;
    } else {
      break;
    }
  }

  const body = lines
    .slice(0, i + 1)
    .join('\n')
    .trimEnd();
  return { body, suggestions };
}

/** Skeleton loading shimmer for streaming messages. */
function SkeletonLoader() {
  return (
    <div className="space-y-2.5 py-1">
      <div className="cybernus-shimmer h-3.5 w-4/5 rounded-md bg-white/[0.04]" />
      <div className="cybernus-shimmer h-3.5 w-3/5 rounded-md bg-white/[0.04] [animation-delay:200ms]" />
      <div className="cybernus-shimmer h-3.5 w-2/3 rounded-md bg-white/[0.04] [animation-delay:400ms]" />
    </div>
  );
}

/** Animated typing indicator dots. */
function TypingIndicator() {
  return (
    <span className="inline-flex items-center gap-1.5 py-1">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400/60 [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400/50 [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400/40 [animation-delay:300ms]" />
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
        'inline-flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-xs font-medium backdrop-blur-sm',
        isSearching
          ? 'border border-white/[0.06] bg-white/[0.03] text-white/60'
          : 'border border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-400',
      )}
    >
      <Globe className={cn('h-3.5 w-3.5', isSearching && 'animate-spin')} />
      <span>{isSearching ? strings.searchingWeb : strings.foundResults}</span>
      {isSearching && (
        <span className="inline-flex gap-0.5">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="inline-block h-1 w-1 animate-bounce rounded-full bg-white/30"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </span>
      )}
    </div>
  );
}

/** Renders assistant message body with follow-up suggestion buttons extracted from → lines. */
function AssistantContent({
  content,
  isStreaming,
  onSendMessage,
  isGenerating,
}: {
  content: string;
  isStreaming: boolean;
  onSendMessage: (text: string) => void;
  isGenerating: boolean;
}) {
  const { body, suggestions } = useMemo(
    () => (isStreaming ? { body: content, suggestions: [] } : extractFollowUps(content)),
    [content, isStreaming],
  );

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      if (!isGenerating) onSendMessage(suggestion);
    },
    [isGenerating, onSendMessage],
  );

  return (
    <div className="relative">
      {renderMarkdown(body, isStreaming)}
      {isStreaming && content && <span className="typing-cursor" />}

      {/* Follow-up suggestion buttons */}
      {suggestions.length > 0 && !isStreaming && (
        <div className="mt-4 flex flex-wrap gap-2">
          {suggestions.map((s, idx) => (
            <button
              key={idx}
              onClick={() => handleSuggestionClick(s)}
              disabled={isGenerating}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.04] px-3 py-1.5 text-xs font-medium text-emerald-400/80 transition-all hover:border-emerald-500/30 hover:bg-emerald-500/[0.08] hover:text-emerald-300 disabled:opacity-40"
            >
              <ArrowRight className="h-3 w-3" />
              {s}
            </button>
          ))}
        </div>
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
            className={cn('group px-4 py-6 md:px-8 lg:px-12', isUser ? 'bg-white/[0.015]' : '')}
          >
            <div className="mx-auto flex max-w-3xl gap-4">
              {/* Avatar */}
              <div className="relative shrink-0 pt-0.5">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg',
                    isUser
                      ? 'bg-gradient-to-br from-white/10 to-white/5 ring-1 ring-white/10'
                      : 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 ring-1 ring-emerald-500/20',
                  )}
                >
                  {isUser ? (
                    <svg
                      className="h-3.5 w-3.5 text-white/70"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                  )}
                </div>
                {isStreaming && (
                  <div className="absolute -inset-1 animate-pulse rounded-lg ring-1 ring-emerald-500/30" />
                )}
              </div>

              {/* Message body */}
              <div className="min-w-0 flex-1">
                {/* Role label */}
                <p
                  className={cn(
                    'mb-2 text-xs font-semibold tracking-wide',
                    isUser ? 'text-white/50' : 'text-emerald-400/80',
                  )}
                >
                  {isUser ? 'You' : 'Cybernus'}
                </p>

                {/* Content */}
                <div className="text-sm leading-relaxed text-white/85">
                  {msg.searchStatus ? (
                    <SearchIndicator status={msg.searchStatus} strings={strings} />
                  ) : !msg.content ? (
                    isStreaming ? (
                      <SkeletonLoader />
                    ) : (
                      <TypingIndicator />
                    )
                  ) : !isUser ? (
                    <AssistantContent
                      content={msg.content}
                      isStreaming={isStreaming}
                      onSendMessage={onSendMessage}
                      isGenerating={isGenerating}
                    />
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>

                {/* Tool action buttons */}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {msg.actions.map((action, idx) => (
                      <button
                        key={idx}
                        onClick={() => executeAction(action)}
                        title={action.url}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-emerald-400/90 transition-all hover:border-emerald-500/30 hover:bg-emerald-500/[0.06]"
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
        <div className="px-4 py-4 md:px-8 lg:px-12">
          <div
            className="cybernus-fade-in-up mx-auto grid max-w-3xl gap-2.5 sm:grid-cols-2"
            style={{ animationDelay: '200ms' }}
          >
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => onSendMessage(q)}
                disabled={isGenerating}
                className="group rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5 text-left text-[13px] leading-relaxed text-white/50 transition-all hover:border-emerald-500/20 hover:bg-emerald-500/[0.03] hover:text-white/70"
              >
                <span>{q}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div ref={messagesEndRef} className="h-6" />
    </div>
  );
}
