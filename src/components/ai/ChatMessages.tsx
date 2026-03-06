/**
 * ChatMessages — Renders the scrollable message list.
 *
 * Features:
 * - Wide-screen layout (max-w-4xl)
 * - Vibrant dark theme with cyan/blue accents
 * - Smooth entry animations per message
 * - Tool-use visibility (thinking status indicator)
 * - Suggested questions grid
 */
import { type RefObject } from 'react';
import { ArrowRight, ExternalLink, Globe, Loader2 } from 'lucide-react';
import { cn } from '@lib/utils/cn';
import type { Language } from '@lib/ai/config';
import type { ChatMessage } from '@lib/ai/types';
import { renderMarkdown } from '@lib/ai/markdown';
import { executeAction } from '@lib/ai/tools';
import { getTranslations } from '@lib/ai/i18n';

interface ChatMessagesProps {
  messages: ChatMessage[];
  isGenerating: boolean;
  /** Current tool/activity status (e.g. "Searching the web…", "Thinking…"). */
  thinkingStatus: string | null;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onSendMessage: (text: string) => void;
  language: Language;
}

/** Renders the scrollable message list with message bubbles and suggested questions. */
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
    <div className="scrollbar-thin flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto max-w-4xl space-y-5">
        {messages.map((msg, msgIndex) => (
          <div
            key={msg.id}
            className={cn(
              'animate-in fade-in slide-in-from-bottom-1 flex gap-3 duration-300',
              msg.role === 'user' ? 'flex-row-reverse' : 'flex-row',
            )}
            style={{ animationDelay: `${Math.min(msgIndex * 30, 150)}ms` }}
          >
            {/* Avatar */}
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-medium',
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-blue-500/30 to-cyan-500/20 text-cyan-300'
                  : 'bg-gradient-to-br from-cyan-500/20 to-purple-500/10 text-cyan-400',
              )}
            >
              {msg.role === 'user' ? (
                <span className="text-[11px] font-semibold">You</span>
              ) : (
                <span className="text-sm">🧠</span>
              )}
            </div>

            {/* Message bubble */}
            <div
              className={cn(
                'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed lg:max-w-[75%]',
                msg.role === 'user'
                  ? 'rounded-tr-md bg-gradient-to-br from-blue-600/90 to-cyan-600/80 text-white shadow-lg shadow-blue-500/10'
                  : 'rounded-tl-md border border-white/[0.06] bg-[#12141f] text-gray-100 shadow-lg shadow-black/20',
              )}
              dir={isRtl ? 'rtl' : 'ltr'}
            >
              {/* Search status indicators */}
              {msg.searchStatus === 'searching' ? (
                <span className="inline-flex items-center gap-2 text-xs text-cyan-400">
                  <Globe className="h-3.5 w-3.5 animate-spin" />
                  <span>{t.searchingWeb}</span>
                  <ThinkingDots color="cyan" />
                </span>
              ) : msg.searchStatus === 'found' ? (
                <span className="inline-flex items-center gap-2 text-xs text-emerald-400">
                  <Globe className="h-3.5 w-3.5" />
                  <span>{t.foundResults}</span>
                  <ThinkingDots color="emerald" />
                </span>
              ) : !msg.content ? (
                /* Empty assistant message = still generating */
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
                  {thinkingStatus && (
                    <span className="text-xs text-cyan-400/80">{thinkingStatus}</span>
                  )}
                  {!thinkingStatus && <ThinkingDots color="cyan" />}
                </div>
              ) : msg.role === 'assistant' ? (
                renderMarkdown(msg.content, isGenerating && msgIndex === messages.length - 1)
              ) : (
                msg.content
              )}

              {/* Tool action buttons */}
              {msg.actions && msg.actions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/[0.06] pt-2.5">
                  {msg.actions.map((action, idx) => (
                    <button
                      key={idx}
                      onClick={() => executeAction(action)}
                      title={action.url}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-1.5 text-xs font-medium text-cyan-400 transition-all hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:shadow-sm hover:shadow-cyan-500/10"
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
          <div className="mx-auto grid max-w-2xl gap-2.5 pt-4 sm:grid-cols-2">
            {t.suggestedQuestions.map((q) => (
              <button
                key={q}
                onClick={() => onSendMessage(q)}
                disabled={isGenerating}
                className="group rounded-xl border border-white/[0.06] bg-[#12141f] px-4 py-3.5 text-left text-xs leading-relaxed text-gray-400 transition-all hover:border-cyan-500/20 hover:bg-cyan-500/5 hover:text-cyan-300 hover:shadow-lg hover:shadow-cyan-500/5"
              >
                <span className="group-hover:text-cyan-400">{q}</span>
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

/** Animated thinking dots. */
function ThinkingDots({ color }: { color: 'cyan' | 'emerald' }) {
  const dotClass = color === 'cyan' ? 'bg-cyan-400' : 'bg-emerald-400';
  return (
    <span className="inline-flex gap-0.5">
      <span className={cn('inline-block h-1 w-1 animate-bounce rounded-full', dotClass)} />
      <span
        className={cn(
          'inline-block h-1 w-1 animate-bounce rounded-full [animation-delay:150ms]',
          dotClass,
        )}
      />
      <span
        className={cn(
          'inline-block h-1 w-1 animate-bounce rounded-full [animation-delay:300ms]',
          dotClass,
        )}
      />
    </span>
  );
}
