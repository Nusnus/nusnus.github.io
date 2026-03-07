import { type RefObject } from 'react';
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

/** Renders the scrollable message list with Matrix-inspired styling. */
export function ChatMessages({
  messages,
  isGenerating,
  messagesEndRef,
  onSendMessage,
  language,
}: ChatMessagesProps) {
  const strings = t(language);
  const dir = language === 'he' ? 'rtl' : 'ltr';

  return (
    <div className="scrollbar-thin flex-1 overflow-y-auto px-4 py-6" dir={dir}>
      <div className="mx-auto max-w-2xl space-y-4">
        {messages.map((msg, msgIndex) => (
          <div
            key={msg.id}
            className={cn('flex gap-3', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}
          >
            {/* Avatar */}
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                msg.role === 'user'
                  ? 'bg-[#00ff41]/20 text-[#00ff41] shadow-[0_0_8px_rgba(0,255,65,0.2)]'
                  : 'bg-cyan-500/15 text-cyan-400 shadow-[0_0_8px_rgba(0,200,255,0.15)]',
              )}
            >
              {msg.role === 'user' ? (
                'You'
              ) : (
                <span className="text-[10px] font-black tracking-wider">CN</span>
              )}
            </div>

            {/* Message bubble */}
            <div
              className={cn(
                'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'rounded-br-md border border-[#00ff41]/20 bg-[#00ff41]/15 text-[#00ff41]'
                  : 'rounded-bl-md border border-cyan-500/10 bg-black/40 text-gray-200',
              )}
            >
              {msg.searchStatus === 'searching' ? (
                <span className="inline-flex items-center gap-2 text-xs text-cyan-400/80">
                  <Globe className="h-3.5 w-3.5 animate-spin" />
                  <span>{strings.searchingWeb}</span>
                  <span className="inline-flex gap-0.5">
                    <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-cyan-400/60" />
                    <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-cyan-400/60 [animation-delay:150ms]" />
                    <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-cyan-400/60 [animation-delay:300ms]" />
                  </span>
                </span>
              ) : msg.searchStatus === 'found' ? (
                <span className="inline-flex items-center gap-2 text-xs text-[#00ff41]/80">
                  <Globe className="h-3.5 w-3.5 text-[#00ff41]" />
                  <span>{strings.foundResults}</span>
                  <span className="inline-flex gap-0.5">
                    <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-[#00ff41]/60" />
                    <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-[#00ff41]/60 [animation-delay:150ms]" />
                    <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-[#00ff41]/60 [animation-delay:300ms]" />
                  </span>
                </span>
              ) : !msg.content ? (
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400/60" />
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400/60 [animation-delay:150ms]" />
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400/60 [animation-delay:300ms]" />
                </span>
              ) : msg.role === 'assistant' ? (
                renderMarkdown(msg.content, isGenerating && msgIndex === messages.length - 1)
              ) : (
                msg.content
              )}

              {/* Tool action buttons */}
              {msg.actions && msg.actions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5 border-t border-[#00ff41]/10 pt-2">
                  {msg.actions.map((action, idx) => (
                    <button
                      key={idx}
                      onClick={() => executeAction(action)}
                      title={action.url}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#00ff41]/20 px-2.5 py-1 text-xs font-medium text-[#00ff41] transition-all hover:border-[#00ff41]/40 hover:bg-[#00ff41]/10 hover:shadow-[0_0_10px_rgba(0,255,65,0.15)]"
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
                className="rounded-xl border border-[#00ff41]/15 bg-black/30 px-4 py-3 text-left text-xs leading-relaxed text-[#00ff41]/70 transition-all hover:border-[#00ff41]/30 hover:bg-[#00ff41]/5 hover:text-[#00ff41]"
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
