/**
 * Chat input footer — textarea, send/stop, voice toggle, message limit.
 */

import { type RefObject, type ReactNode } from 'react';
import { Send, Square } from 'lucide-react';
import { cn } from '@lib/utils/cn';

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  isGenerating: boolean;
  isAtLimit: boolean;
  userMsgCount: number;
  maxMessages: number;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  /** Voice button slot (rendered between textarea and send button). */
  voiceSlot?: ReactNode;
  onSend: (text: string) => void;
  onStop: () => void;
  onClearChat: () => void;
}

export function ChatInput({
  input,
  setInput,
  isGenerating,
  isAtLimit,
  userMsgCount,
  maxMessages,
  inputRef,
  voiceSlot,
  onSend,
  onStop,
  onClearChat,
}: ChatInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend(input);
    }
  };

  return (
    <div className="border-border border-t px-4 py-3 md:px-8">
      <div className="mx-auto max-w-4xl">
        {isAtLimit ? (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <p className="text-text-secondary text-sm">
              You've reached the {maxMessages}-message limit for this chat.
            </p>
            <button
              onClick={onClearChat}
              className="bg-accent text-bg-base hover:bg-accent-hover rounded-xl px-6 py-2.5 text-sm font-semibold transition-colors"
            >
              Start New Chat
            </button>
          </div>
        ) : (
          <>
            <div className="bg-bg-surface border-border flex items-end gap-2 rounded-xl border px-4 py-3">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
                }}
                onKeyDown={handleKeyDown}
                placeholder="Ask Cybernus anything…"
                rows={1}
                className="text-text-primary placeholder:text-text-muted max-h-32 flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none"
                disabled={isGenerating}
                aria-label="Chat message input"
              />
              {voiceSlot}
              {isGenerating ? (
                <button
                  onClick={onStop}
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-400 transition-colors hover:bg-red-500/20"
                  aria-label="Stop generating"
                >
                  <Square className="size-4 fill-current" />
                </button>
              ) : (
                <button
                  onClick={() => onSend(input)}
                  disabled={!input.trim()}
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors',
                    input.trim()
                      ? 'bg-accent text-bg-base hover:bg-accent-hover'
                      : 'text-text-muted cursor-not-allowed',
                  )}
                  aria-label="Send message"
                >
                  <Send className="size-4" />
                </button>
              )}
            </div>
            <p className="text-text-muted mt-2 px-1 text-[10px]">
              Grok 4.1 Fast (reasoning) via xAI · Responses may be inaccurate
              {userMsgCount > 0 && ` · ${userMsgCount}/${maxMessages} messages`}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
