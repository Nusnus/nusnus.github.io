import { type RefObject } from 'react';
import { Send, Square } from 'lucide-react';
import { cn } from '@lib/utils/cn';
import type { ChatProvider } from '@lib/ai/config';

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  isGenerating: boolean;
  isAtLimit: boolean;
  userMsgCount: number;
  maxMessages: number;
  provider: ChatProvider;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onSend: (text: string) => void;
  onStop: () => void;
  onClearChat: () => void;
}

/** Chat input footer — textarea + send/stop + message limit banner. */
export function ChatInput({
  input,
  setInput,
  isGenerating,
  isAtLimit,
  userMsgCount,
  maxMessages,
  provider,
  inputRef,
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
    <div className="border-border border-t px-4 py-3">
      <div className="mx-auto max-w-2xl">
        {isAtLimit ? (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <p className="text-text-secondary text-sm">
              You've reached the {maxMessages}-message limit for this chat.
            </p>
            <button
              onClick={onClearChat}
              className="bg-accent text-bg-base hover:bg-accent-hover glow-accent-sm rounded-xl px-6 py-2.5 text-sm font-semibold transition-all duration-200 hover:shadow-lg"
            >
              Start New Chat
            </button>
          </div>
        ) : (
          <>
            <div className="glass-subtle border-border/50 ring-border/30 focus-within:ring-accent/40 focus-within:glow-accent-sm flex items-end gap-2 rounded-xl border px-4 py-3 ring-1 transition-all duration-200">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  // Auto-resize
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
                }}
                onKeyDown={handleKeyDown}
                placeholder="Ask about Tomer…"
                rows={1}
                className="text-text-primary placeholder:text-text-muted max-h-32 flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none"
                disabled={isGenerating}
                aria-label="Chat message input"
              />
              {isGenerating ? (
                <button
                  onClick={onStop}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-400 ring-1 ring-red-500/20 transition-all duration-200 hover:bg-red-500/20 hover:ring-red-500/40"
                  aria-label="Stop generating"
                  style={{ animation: 'border-glow 2s ease-in-out infinite' }}
                >
                  <Square className="h-4 w-4 fill-current" />
                </button>
              ) : (
                <button
                  onClick={() => onSend(input)}
                  disabled={!input.trim()}
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all duration-200',
                    input.trim()
                      ? 'bg-accent text-bg-base hover:bg-accent-hover shadow-accent/20 hover:shadow-accent/30 shadow-lg'
                      : 'text-text-muted cursor-not-allowed',
                  )}
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between px-1">
              <p className="text-text-muted text-[10px]">
                {provider === 'cloud'
                  ? 'Powered by xAI Grok · Responses may be inaccurate'
                  : 'AI runs locally in your browser via WebGPU · Responses may be inaccurate'}
              </p>
              {userMsgCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="bg-bg-elevated h-1 w-16 overflow-hidden rounded-full">
                    <div
                      className="bg-accent h-full rounded-full transition-all duration-300"
                      style={{ width: `${(userMsgCount / maxMessages) * 100}%` }}
                    />
                  </div>
                  <span className="text-text-muted text-[10px]">
                    {userMsgCount}/{maxMessages}
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
