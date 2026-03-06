import { type RefObject } from 'react';
import { ArrowRight, ExternalLink, Globe } from 'lucide-react';
import { cn } from '@lib/utils/cn';
import { SUGGESTED_QUESTIONS } from '@lib/ai/config';
import type { Language } from '@lib/ai/config';
import type { ChatMessage } from '@lib/ai/types';
import { renderMarkdown } from '@lib/ai/markdown';
import { executeAction } from '@lib/ai/tools';
import { getTranslations } from '@lib/ai/i18n';

interface ChatMessagesProps {
  messages: ChatMessage[];
  isGenerating: boolean;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onSendMessage: (text: string) => void;
  language: Language;
}

/** Renders the scrollable message list with message bubbles and suggested questions. */
export function ChatMessages({
  messages,
  isGenerating,
  messagesEndRef,
  onSendMessage,
  language,
}: ChatMessagesProps) {
  const t = getTranslations(language);
  const isRtl = language === 'he';

  return (
    <div className="scrollbar-thin flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto max-w-2xl space-y-4">
        {messages.map((msg, msgIndex) => (
          <div
            key={msg.id}
            className={cn('flex gap-3', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}
          >
            {/* Avatar */}
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium',
                msg.role === 'user'
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-cyan-500/10 text-cyan-400',
              )}
            >
              {msg.role === 'user' ? <span>You</span> : <span className="text-sm">🧠</span>}
            </div>

            {/* Message bubble */}
            <div
              className={cn(
                'max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'rounded-br-md bg-green-500/90 text-black'
                  : 'rounded-bl-md border border-green-500/10 bg-[#0a120a] text-green-50',
              )}
              dir={isRtl ? 'rtl' : 'ltr'}
            >
              {msg.searchStatus === 'searching' ? (
                <span className="text-text-muted inline-flex items-center gap-2 text-xs">
                  <Globe className="h-3.5 w-3.5 animate-spin text-cyan-400" />
                  <span>{t.searchingWeb}</span>
                  <span className="inline-flex gap-0.5">
                    <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-cyan-400" />
                    <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-cyan-400 [animation-delay:150ms]" />
                    <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-cyan-400 [animation-delay:300ms]" />
                  </span>
                </span>
              ) : msg.searchStatus === 'found' ? (
                <span className="text-text-muted inline-flex items-center gap-2 text-xs">
                  <Globe className="h-3.5 w-3.5 text-green-500" />
                  <span>{t.foundResults}</span>
                  <span className="inline-flex gap-0.5">
                    <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-green-400" />
                    <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-green-400 [animation-delay:150ms]" />
                    <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-green-400 [animation-delay:300ms]" />
                  </span>
                </span>
              ) : !msg.content ? (
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-400 [animation-delay:150ms]" />
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-400 [animation-delay:300ms]" />
                </span>
              ) : msg.role === 'assistant' ? (
                renderMarkdown(msg.content, isGenerating && msgIndex === messages.length - 1)
              ) : (
                msg.content
              )}

              {/* Tool action buttons */}
              {msg.actions && msg.actions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5 border-t border-green-500/20 pt-2">
                  {msg.actions.map((action, idx) => (
                    <button
                      key={idx}
                      onClick={() => executeAction(action)}
                      title={action.url}
                      className="inline-flex items-center gap-1 rounded-lg border border-green-500/30 px-2.5 py-1 text-xs font-medium text-green-400 transition-colors hover:border-green-500/50 hover:bg-green-500/10"
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
          <div className="mx-auto grid max-w-lg gap-2 pt-2 sm:grid-cols-2">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => onSendMessage(q)}
                disabled={isGenerating}
                className="rounded-xl border border-green-500/20 bg-[#0a120a] px-4 py-3 text-left text-xs leading-relaxed text-green-300/80 transition-all hover:border-green-500/40 hover:bg-green-500/5 hover:text-green-300"
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
