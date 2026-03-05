import { type RefObject } from 'react';
import { ArrowRight, ExternalLink, Globe } from 'lucide-react';
import { cn } from '@lib/utils/cn';
import { getStrings, getSuggestedQuestions, type ChatLanguage } from '@lib/ai/config';
import type { ChatMessage } from '@lib/ai/types';
import { renderMarkdown } from '@lib/ai/markdown';
import { executeAction } from '@lib/ai/tools';
import { CybernusThinking } from './CybernusThinking';

interface ChatMessagesProps {
  messages: ChatMessage[];
  isGenerating: boolean;
  language: ChatLanguage;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onSendMessage: (text: string) => void;
}

/** Cybernus avatar — glowing ring with a C glyph. */
function CybernusAvatar() {
  return (
    <div className="ring-accent/30 bg-accent/10 text-accent shadow-accent/20 relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold shadow-lg ring-1">
      C
      <span className="bg-accent absolute -top-0.5 -right-0.5 h-2 w-2 animate-pulse rounded-full" />
    </div>
  );
}

/** Animated dots shown when the assistant bubble has no content yet and isn't thinking. */
function LoadingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="bg-text-muted inline-block h-1.5 w-1.5 animate-pulse rounded-full" />
      <span className="bg-text-muted inline-block h-1.5 w-1.5 animate-pulse rounded-full [animation-delay:150ms]" />
      <span className="bg-text-muted inline-block h-1.5 w-1.5 animate-pulse rounded-full [animation-delay:300ms]" />
    </span>
  );
}

/** Search status indicator (searching / found). */
function SearchStatus({
  status,
  language,
}: {
  status: 'searching' | 'found';
  language: ChatLanguage;
}) {
  const strings = getStrings(language);
  const isFound = status === 'found';
  return (
    <span className="text-text-muted inline-flex items-center gap-2 text-xs">
      <Globe className={cn('h-3.5 w-3.5', isFound ? 'text-accent' : 'animate-spin')} />
      <span>{isFound ? strings.found : strings.searching}</span>
      <span className="inline-flex gap-0.5">
        <span
          className={cn(
            'bg-text-muted inline-block h-1 w-1 rounded-full',
            isFound ? 'animate-pulse' : 'animate-bounce',
          )}
        />
        <span
          className={cn(
            'bg-text-muted inline-block h-1 w-1 rounded-full [animation-delay:150ms]',
            isFound ? 'animate-pulse' : 'animate-bounce',
          )}
        />
        <span
          className={cn(
            'bg-text-muted inline-block h-1 w-1 rounded-full [animation-delay:300ms]',
            isFound ? 'animate-pulse' : 'animate-bounce',
          )}
        />
      </span>
    </span>
  );
}

/** Renders the scrollable message list with message bubbles and suggested questions. */
export function ChatMessages({
  messages,
  isGenerating,
  language,
  messagesEndRef,
  onSendMessage,
}: ChatMessagesProps) {
  const suggestedQuestions = getSuggestedQuestions(language);

  // Hide summary messages — they're context-only.
  const visibleMessages = messages.filter((m) => !m.isSummary);

  return (
    <div className="scrollbar-thin flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto max-w-4xl space-y-4">
        {visibleMessages.map((msg, msgIndex) => (
          <div
            key={msg.id}
            className={cn('flex gap-3', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}
          >
            {msg.role === 'user' ? (
              <div className="bg-accent/20 text-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                You
              </div>
            ) : (
              <CybernusAvatar />
            )}
            <div
              className={cn(
                'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed sm:max-w-[75%]',
                msg.role === 'user'
                  ? 'bg-accent text-bg-base rounded-br-md'
                  : 'bg-bg-surface/80 text-text-primary border-accent/10 rounded-bl-md border backdrop-blur-sm',
              )}
            >
              {msg.thinking ? (
                <CybernusThinking language={language} />
              ) : msg.searchStatus === 'searching' ? (
                <SearchStatus status="searching" language={language} />
              ) : msg.searchStatus === 'found' ? (
                <SearchStatus status="found" language={language} />
              ) : !msg.content ? (
                <LoadingDots />
              ) : msg.role === 'assistant' ? (
                renderMarkdown(msg.content, isGenerating && msgIndex === visibleMessages.length - 1)
              ) : (
                msg.content
              )}

              {/* Tool action buttons */}
              {msg.actions && msg.actions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5 border-t border-white/10 pt-2">
                  {msg.actions.map((action, idx) => (
                    <button
                      key={idx}
                      onClick={() => executeAction(action)}
                      title={action.url}
                      className="text-accent border-accent/30 hover:bg-accent/15 hover:border-accent/50 inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors"
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
        ))}

        {/* Suggested questions — shown after welcome message only */}
        {visibleMessages.length === 1 && visibleMessages[0]?.role === 'assistant' && (
          <div className="mx-auto grid max-w-2xl gap-2 pt-2 sm:grid-cols-2">
            {suggestedQuestions.map((q) => (
              <button
                key={q}
                onClick={() => onSendMessage(q)}
                disabled={isGenerating}
                className="bg-bg-surface/60 hover:bg-bg-elevated border-accent/10 hover:border-accent/30 text-text-secondary hover:text-text-primary rounded-xl border px-4 py-3 text-left text-xs leading-relaxed backdrop-blur-sm transition-all"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
