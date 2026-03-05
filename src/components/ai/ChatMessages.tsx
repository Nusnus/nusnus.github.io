/**
 * Chat message list — memoized bubbles, activity indicators, suggested prompts.
 *
 * Each bubble is memoized on (content, status, actions) so only the streaming
 * bubble re-renders while tokens arrive. The activity indicator shows what
 * Cybernus is doing *before* text appears: thinking, searching, reading a
 * repo, executing code.
 */

import { memo, type RefObject } from 'react';
import { ArrowRight, Bot, Brain, Code2, ExternalLink, Globe, Library } from 'lucide-react';
import { cn } from '@lib/utils/cn';
import { SUGGESTED_QUESTIONS } from '@lib/ai/config';
import type { ChatMessage } from '@lib/ai/types';
import { renderMarkdown } from '@lib/ai/markdown';
import { executeAction } from '@lib/ai/tools';

/* ─── Single bubble — memoized ─── */

interface BubbleProps {
  msg: ChatMessage;
  /** Is this the last assistant message AND currently generating? */
  streaming: boolean;
}

const Bubble = memo(
  function Bubble({ msg, streaming }: BubbleProps) {
    const isUser = msg.role === 'user';
    return (
      <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
        {/* Avatar */}
        <div
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium',
            isUser ? 'bg-accent/20 text-accent' : 'bg-bg-elevated text-text-secondary',
          )}
        >
          {isUser ? 'You' : <Bot className="size-4" />}
        </div>

        {/* Bubble */}
        <div
          className={cn(
            'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
            isUser
              ? 'bg-accent text-bg-base rounded-br-md'
              : 'bg-bg-surface text-text-primary rounded-bl-md',
          )}
        >
          {msg.content ? (
            isUser ? (
              <span className="whitespace-pre-wrap">{msg.content}</span>
            ) : (
              renderMarkdown(msg.content, streaming)
            )
          ) : (
            <ActivityIndicator status={msg.status} reasoningTokens={msg.reasoningTokens} />
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
                    <ExternalLink className="size-3" />
                  ) : (
                    <ArrowRight className="size-3" />
                  )}
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.msg.content === next.msg.content &&
    prev.msg.status === next.msg.status &&
    prev.msg.reasoningTokens === next.msg.reasoningTokens &&
    prev.msg.actions === next.msg.actions &&
    prev.streaming === next.streaming,
);

/* ─── Activity indicator (shown before text arrives) ─── */

const STATUS_CONFIG = {
  thinking: { Icon: Brain, label: 'Reasoning', color: 'text-accent' },
  searching: { Icon: Globe, label: 'Searching the web', color: 'text-blue-400' },
  reading: { Icon: Library, label: 'Reading repository', color: 'text-purple-400' },
  coding: { Icon: Code2, label: 'Executing code', color: 'text-orange-400' },
  found: { Icon: Globe, label: 'Synthesizing', color: 'text-green-400' },
} as const;

function ActivityIndicator({
  status,
  reasoningTokens,
}: {
  status: ChatMessage['status'];
  reasoningTokens: number | undefined;
}) {
  const config = status ? STATUS_CONFIG[status] : null;

  if (!config) {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="bg-text-muted inline-block size-1.5 animate-pulse rounded-full" />
        <span className="bg-text-muted inline-block size-1.5 animate-pulse rounded-full [animation-delay:150ms]" />
        <span className="bg-text-muted inline-block size-1.5 animate-pulse rounded-full [animation-delay:300ms]" />
      </span>
    );
  }

  const { Icon, label, color } = config;
  return (
    <span className="text-text-muted inline-flex items-center gap-2 text-xs">
      <Icon
        className={cn('size-3.5', status === 'thinking' ? 'animate-pulse' : 'animate-spin', color)}
      />
      <span>
        {label}
        {status === 'thinking' && reasoningTokens ? (
          <span className="text-accent font-mono">
            {' '}
            · {reasoningTokens.toLocaleString()} tokens
          </span>
        ) : null}
      </span>
      <span className="inline-flex gap-0.5">
        <span className="bg-text-muted inline-block size-1 animate-bounce rounded-full" />
        <span className="bg-text-muted inline-block size-1 animate-bounce rounded-full [animation-delay:150ms]" />
        <span className="bg-text-muted inline-block size-1 animate-bounce rounded-full [animation-delay:300ms]" />
      </span>
    </span>
  );
}

/* ─── Main list ─── */

interface ChatMessagesProps {
  messages: ChatMessage[];
  isGenerating: boolean;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onSendMessage: (text: string) => void;
}

export function ChatMessages({
  messages,
  isGenerating,
  messagesEndRef,
  onSendMessage,
}: ChatMessagesProps) {
  const lastIdx = messages.length - 1;

  return (
    <div className="scrollbar-thin flex-1 overflow-y-auto px-4 py-6 md:px-8">
      <div className="mx-auto max-w-4xl space-y-4">
        {messages.map((msg, i) => (
          <Bubble
            key={msg.id}
            msg={msg}
            streaming={isGenerating && i === lastIdx && msg.role === 'assistant'}
          />
        ))}

        {/* Suggested prompts — welcome state only, mobile/narrow screens */}
        {messages.length === 1 && messages[0]?.role === 'assistant' && (
          <div className="grid gap-2 pt-2 sm:grid-cols-2 xl:hidden">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => onSendMessage(q)}
                disabled={isGenerating}
                className="bg-bg-surface hover:bg-bg-elevated border-border text-text-secondary hover:text-text-primary rounded-xl border px-4 py-3 text-left text-xs leading-relaxed transition-colors"
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
