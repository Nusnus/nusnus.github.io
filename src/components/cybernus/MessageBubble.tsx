/**
 * MessageBubble — renders a single chat message.
 *
 * User messages are right-aligned plain bubbles. Assistant messages
 * are left-aligned, render full markdown, and may carry tool action
 * buttons below the content.
 *
 * Memoised on message content so only the streaming bubble re-renders
 * during a response — historical messages stay cached.
 */

import { memo } from 'react';

import type { ChatMessage, ToolAction } from '@lib/ai/types';
import { renderMarkdown } from '@lib/ai/markdown';
import { cn } from '@lib/utils/cn';

interface MessageBubbleProps {
  message: ChatMessage;
  /** True for the message currently being streamed (skip markdown cache). */
  streaming?: boolean;
}

/** Execute a client-side tool action. */
function runAction(action: ToolAction): void {
  if (action.type === 'navigate') {
    window.location.href = action.url;
  } else {
    window.open(action.url, '_blank', 'noopener,noreferrer');
  }
}

export const MessageBubble = memo(
  function MessageBubble({ message, streaming = false }: MessageBubbleProps) {
    const isUser = message.role === 'user';

    return (
      <div className={cn('cybernus-msg-in flex w-full', isUser ? 'justify-end' : 'justify-start')}>
        <div
          className={cn(
            'max-w-[min(100%,48rem)] rounded-2xl px-4 py-2.5 text-sm',
            isUser
              ? 'bg-accent/15 border-accent/30 border'
              : 'bg-bg-surface/60 border-border border',
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <>
              <div className="prose-invert text-text-primary">
                {renderMarkdown(message.content, streaming)}
                {/* Blinking caret while streaming. */}
                {streaming && message.content && (
                  <span className="bg-accent ml-0.5 inline-block h-4 w-0.5 animate-pulse align-text-bottom" />
                )}
              </div>

              {/* Tool action buttons (open_link / navigate). */}
              {message.actions && message.actions.length > 0 && (
                <div className="border-border/50 mt-3 flex flex-wrap gap-2 border-t pt-3">
                  {message.actions.map((a, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => runAction(a)}
                      className="border-accent/40 bg-accent/10 text-accent hover:bg-accent/20 rounded-lg border px-3 py-1.5 text-xs transition-colors"
                    >
                      {a.type === 'navigate' ? '→ ' : '↗ '}
                      {a.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Final reasoning-token stat (tiny, muted — for the curious). */}
              {!streaming && message.reasoningTokens !== undefined && (
                <div className="text-text-muted mt-2 font-mono text-[10px]">
                  {message.reasoningTokens.toLocaleString()} reasoning tokens
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  },
  // Re-render only if the relevant message fields change. Cheap shallow compare
  // so the whole message list doesn't thrash while one bubble streams.
  (prev, next) =>
    prev.streaming === next.streaming &&
    prev.message.content === next.message.content &&
    prev.message.actions === next.message.actions &&
    prev.message.reasoningTokens === next.message.reasoningTokens,
);
