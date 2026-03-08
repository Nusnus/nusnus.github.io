import { type RefObject } from 'react';
import { ArrowRight, Bot, ExternalLink, Globe } from 'lucide-react';
import { cn } from '@lib/utils/cn';
import { SUGGESTED_QUESTIONS } from '@lib/ai/config';
import type { ChatMessage } from '@lib/ai/types';
import { renderMarkdown } from '@lib/ai/markdown';
import { executeAction } from '@lib/ai/tools';

interface ChatMessagesProps {
  messages: ChatMessage[];
  isGenerating: boolean;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onSendMessage: (text: string) => void;
}

/** Renders the scrollable message list with message bubbles and suggested questions. */
export function ChatMessages({
  messages,
  isGenerating,
  messagesEndRef,
  onSendMessage,
}: ChatMessagesProps) {
  return (
    <div className="scrollbar-thin flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto max-w-2xl space-y-4">
        {messages.map((msg, msgIndex) => (
          <div
            key={msg.id}
            className={cn('flex gap-3', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}
            style={{
              animation: 'fade-in-up 0.3s ease-out both',
            }}
          >
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium ring-1',
                msg.role === 'user'
                  ? 'bg-accent/20 text-accent ring-accent/30'
                  : 'bg-bg-elevated text-text-secondary ring-border/50',
              )}
            >
              {msg.role === 'user' ? 'You' : <Bot className="h-4 w-4" />}
            </div>
            <div
              className={cn(
                'max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'from-accent to-accent-hover text-bg-base shadow-accent/10 rounded-br-md bg-gradient-to-br shadow-lg'
                  : 'glass-subtle border-border/50 ring-border/30 text-text-primary rounded-bl-md border ring-1',
              )}
            >
              {msg.searchStatus === 'searching' ? (
                <span className="text-text-muted inline-flex items-center gap-2 text-xs">
                  <Globe className="h-3.5 w-3.5 animate-spin" />
                  <span>Searching the web</span>
                  <span className="inline-flex gap-0.5">
                    <span className="bg-text-muted inline-block h-1 w-1 animate-bounce rounded-full" />
                    <span className="bg-text-muted inline-block h-1 w-1 animate-bounce rounded-full [animation-delay:150ms]" />
                    <span className="bg-text-muted inline-block h-1 w-1 animate-bounce rounded-full [animation-delay:300ms]" />
                  </span>
                </span>
              ) : msg.searchStatus === 'found' ? (
                <span className="text-text-muted inline-flex items-center gap-2 text-xs">
                  <Globe className="h-3.5 w-3.5 text-green-500" />
                  <span>Found results, synthesizing</span>
                  <span className="inline-flex gap-0.5">
                    <span className="bg-text-muted inline-block h-1 w-1 animate-pulse rounded-full" />
                    <span className="bg-text-muted inline-block h-1 w-1 animate-pulse rounded-full [animation-delay:150ms]" />
                    <span className="bg-text-muted inline-block h-1 w-1 animate-pulse rounded-full [animation-delay:300ms]" />
                  </span>
                </span>
              ) : !msg.content ? (
                <span className="inline-flex items-center gap-1">
                  <span className="bg-text-muted inline-block h-1.5 w-1.5 animate-pulse rounded-full" />
                  <span className="bg-text-muted inline-block h-1.5 w-1.5 animate-pulse rounded-full [animation-delay:150ms]" />
                  <span className="bg-text-muted inline-block h-1.5 w-1.5 animate-pulse rounded-full [animation-delay:300ms]" />
                </span>
              ) : msg.role === 'assistant' ? (
                renderMarkdown(msg.content, isGenerating && msgIndex === messages.length - 1)
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
        {messages.length === 1 && messages[0]?.role === 'assistant' && (
          <div className="mx-auto grid max-w-lg gap-2 pt-4 sm:grid-cols-2">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => onSendMessage(q)}
                disabled={isGenerating}
                className="glass-subtle group border-border/50 ring-border/30 hover:ring-accent/30 hover:glow-accent-sm rounded-xl border px-4 py-3.5 text-left text-xs leading-relaxed ring-1 transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50"
              >
                <span className="text-text-secondary group-hover:text-text-primary transition-colors">
                  {q}
                </span>
              </button>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
