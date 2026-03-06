/**
 * ChatMessages — Renders the scrollable message list.
 *
 * Matrix-inspired dark theme with neon green accents.
 * Uses full width of the main panel, no max-width constraint.
 */
import { type RefObject } from 'react';
import { ArrowRight, ExternalLink, Globe, Loader2, Terminal } from 'lucide-react';
import { cn } from '@lib/utils/cn';
import type { Language } from '@lib/ai/config';
import type { ChatMessage } from '@lib/ai/types';
import { renderMarkdown } from '@lib/ai/markdown';
import { executeAction } from '@lib/ai/tools';
import { getTranslations } from '@lib/ai/i18n';

interface ChatMessagesProps {
  messages: ChatMessage[];
  isGenerating: boolean;
  thinkingStatus: string | null;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onSendMessage: (text: string) => void;
  language: Language;
}

export function ChatMessages({
  messages,
  isGenerating,
  thinkingStatus,
  messagesEndRef,
  onSendMessage,
  language,
}: ChatMessagesProps) {
  const t = getTranslations(language);
  const isRtl = language === 'he';

  return (
    <div className="scrollbar-thin flex-1 overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-5xl space-y-4">
        {messages.map((msg, msgIndex) => (
          <div
            key={msg.id}
            className={cn(
              'animate-in fade-in slide-in-from-bottom-1 flex gap-3 duration-200',
              msg.role === 'user' ? 'flex-row-reverse' : 'flex-row',
            )}
            style={{ animationDelay: `${Math.min(msgIndex * 20, 100)}ms` }}
          >
            {/* Avatar */}
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold',
                msg.role === 'user'
                  ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : 'border border-emerald-500/20 bg-black text-emerald-500',
              )}
            >
              {msg.role === 'user' ? '>' : <Terminal className="h-3.5 w-3.5" />}
            </div>

            {/* Message bubble */}
            <div
              className={cn(
                'max-w-[85%] rounded-lg px-4 py-3 text-sm leading-relaxed lg:max-w-[80%]',
                msg.role === 'user'
                  ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                  : 'border border-emerald-500/[0.08] bg-[#0a0a0a] text-gray-200',
              )}
              dir={isRtl ? 'rtl' : 'ltr'}
            >
              {/* Search status */}
              {msg.searchStatus === 'searching' ? (
                <span className="inline-flex items-center gap-2 font-mono text-xs text-emerald-500">
                  <Globe className="h-3.5 w-3.5 animate-spin" />
                  <span>{t.searchingWeb}</span>
                  <ThinkingDots />
                </span>
              ) : msg.searchStatus === 'found' ? (
                <span className="inline-flex items-center gap-2 font-mono text-xs text-emerald-400">
                  <Globe className="h-3.5 w-3.5" />
                  <span>{t.foundResults}</span>
                  <ThinkingDots />
                </span>
              ) : !msg.content ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-500" />
                  {thinkingStatus && (
                    <span className="font-mono text-xs text-emerald-500/80">{thinkingStatus}</span>
                  )}
                  {!thinkingStatus && <ThinkingDots />}
                </div>
              ) : msg.role === 'assistant' ? (
                renderMarkdown(msg.content, isGenerating && msgIndex === messages.length - 1)
              ) : (
                msg.content
              )}

              {/* Tool action buttons */}
              {msg.actions && msg.actions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-emerald-500/10 pt-2.5">
                  {msg.actions.map((action, idx) => (
                    <button
                      key={idx}
                      onClick={() => executeAction(action)}
                      title={action.url}
                      className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 font-mono text-[11px] font-medium text-emerald-400 transition-all hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:shadow-sm hover:shadow-emerald-500/10"
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

        {/* Suggested questions */}
        {messages.length === 1 && messages[0]?.role === 'assistant' && (
          <div className="mx-auto grid max-w-3xl gap-2 pt-6 sm:grid-cols-2">
            {t.suggestedQuestions.map((q) => (
              <button
                key={q}
                onClick={() => onSendMessage(q)}
                disabled={isGenerating}
                className="group rounded-lg border border-emerald-500/10 bg-[#0a0a0a] px-4 py-3 text-left font-mono text-[11px] leading-relaxed text-emerald-700 transition-all hover:border-emerald-500/30 hover:bg-emerald-500/5 hover:text-emerald-400 hover:shadow-lg hover:shadow-emerald-500/5"
              >
                <span className="text-emerald-600 group-hover:text-emerald-400">{'> '}</span>
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

/* ─── Sub-components ─── */

function ThinkingDots() {
  return (
    <span className="inline-flex gap-0.5">
      <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-emerald-500" />
      <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-emerald-500 [animation-delay:150ms]" />
      <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-emerald-500 [animation-delay:300ms]" />
    </span>
  );
}
