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
    <div className="mobile-smooth-scroll scrollbar-thin flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-12">
      <div className="mx-auto max-w-5xl space-y-6">
        {messages.map((msg, msgIndex) => (
          <div
            key={msg.id}
            className={cn(
              'flex animate-[message-slide-in_0.3s_ease-out] gap-4 motion-reduce:animate-none',
              msg.role === 'user' ? 'flex-row-reverse' : 'flex-row',
            )}
          >
            {/* Avatar */}
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold ring-1 transition-all duration-150',
                msg.role === 'user'
                  ? 'bg-accent/10 text-accent ring-accent/30 shadow-[0_0_12px_oklch(0.72_0.17_145_/_0.2)]'
                  : 'bg-bg-elevated text-text-secondary ring-border shadow-sm',
              )}
            >
              {msg.role === 'user' ? (
                <span className="font-mono">U</span>
              ) : (
                <Bot className="h-5 w-5" />
              )}
            </div>

            {/* Message bubble */}
            <div
              className={cn(
                'group relative max-w-[85%] rounded-xl px-5 py-4 text-sm leading-relaxed shadow-lg ring-1 transition-all duration-150',
                msg.role === 'user'
                  ? 'from-accent to-accent/90 text-bg-base ring-accent/40 rounded-br-sm bg-gradient-to-br shadow-[0_4px_16px_oklch(0.72_0.17_145_/_0.25)]'
                  : 'bg-bg-surface/80 text-text-primary ring-border/50 hover:ring-accent/20 rounded-bl-sm backdrop-blur-sm',
              )}
            >
              {msg.searchStatus === 'searching' ? (
                <span className="bg-bg-base/50 text-accent ring-accent/20 inline-flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium ring-1">
                  <Globe className="h-4 w-4 animate-spin" />
                  <span className="font-mono">Searching the web</span>
                  <span className="inline-flex gap-1">
                    <span className="bg-accent inline-block h-1 w-1 animate-[thinking-pulse_1s_ease-in-out_infinite] rounded-full" />
                    <span className="bg-accent inline-block h-1 w-1 animate-[thinking-pulse_1s_ease-in-out_infinite] rounded-full [animation-delay:200ms]" />
                    <span className="bg-accent inline-block h-1 w-1 animate-[thinking-pulse_1s_ease-in-out_infinite] rounded-full [animation-delay:400ms]" />
                  </span>
                </span>
              ) : msg.searchStatus === 'found' ? (
                <span className="bg-bg-base/50 text-accent ring-accent/30 inline-flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium ring-1">
                  <Globe
                    className="text-accent h-4 w-4"
                    style={{
                      filter: 'drop-shadow(0 0 4px oklch(0.72 0.17 145 / 0.6))',
                    }}
                  />
                  <span className="font-mono">Synthesizing results</span>
                  <span className="inline-flex gap-1">
                    <span className="bg-accent inline-block h-1 w-1 animate-[thinking-pulse_1s_ease-in-out_infinite] rounded-full" />
                    <span className="bg-accent inline-block h-1 w-1 animate-[thinking-pulse_1s_ease-in-out_infinite] rounded-full [animation-delay:200ms]" />
                    <span className="bg-accent inline-block h-1 w-1 animate-[thinking-pulse_1s_ease-in-out_infinite] rounded-full [animation-delay:400ms]" />
                  </span>
                </span>
              ) : !msg.content ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="bg-accent inline-block h-2 w-2 animate-[thinking-pulse_1s_ease-in-out_infinite] rounded-full" />
                  <span className="bg-accent inline-block h-2 w-2 animate-[thinking-pulse_1s_ease-in-out_infinite] rounded-full [animation-delay:200ms]" />
                  <span className="bg-accent inline-block h-2 w-2 animate-[thinking-pulse_1s_ease-in-out_infinite] rounded-full [animation-delay:400ms]" />
                </span>
              ) : msg.role === 'assistant' ? (
                renderMarkdown(msg.content, isGenerating && msgIndex === messages.length - 1)
              ) : (
                msg.content
              )}

              {/* Tool action buttons */}
              {msg.actions && msg.actions.length > 0 && (
                <div className="border-accent/10 mt-3 flex flex-wrap gap-2 border-t pt-3">
                  {msg.actions.map((action, idx) => (
                    <button
                      key={idx}
                      onClick={() => executeAction(action)}
                      title={action.url}
                      className="group border-accent/30 bg-accent/5 text-accent hover:border-accent/50 hover:bg-accent/10 hover:ring-accent/20 focus-visible:ring-accent focus-visible:ring-offset-bg-surface inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium ring-1 ring-transparent transition-all duration-150 hover:shadow-[0_0_12px_oklch(0.72_0.17_145_/_0.2)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                      {action.type === 'open_link' ? (
                        <ExternalLink className="h-3.5 w-3.5 transition-transform duration-150 group-hover:scale-110" />
                      ) : (
                        <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                      )}
                      <span className="font-mono">{action.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Suggested questions — shown after welcome message only */}
        {messages.length === 1 && messages[0]?.role === 'assistant' && (
          <div className="mx-auto grid max-w-3xl gap-3 pt-4 sm:grid-cols-2">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => onSendMessage(q)}
                disabled={isGenerating}
                className="group border-accent/20 bg-bg-surface/50 text-text-secondary hover:border-accent/40 hover:bg-bg-surface hover:text-accent hover:ring-accent/10 focus-visible:ring-accent focus-visible:ring-offset-bg-base relative overflow-hidden rounded-xl border px-5 py-4 text-left text-xs leading-relaxed shadow-sm ring-1 ring-transparent backdrop-blur-sm transition-all duration-150 hover:shadow-[0_0_16px_oklch(0.72_0.17_145_/_0.15)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="relative z-10 font-medium">{q}</span>
                {/* Hover glow effect */}
                <div
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                  style={{
                    background:
                      'radial-gradient(circle at center, oklch(0.72 0.17 145 / 0.05), transparent 70%)',
                  }}
                  aria-hidden="true"
                ></div>
              </button>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
