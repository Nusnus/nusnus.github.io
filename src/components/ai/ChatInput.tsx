import { type RefObject } from 'react';
import { Send, Square } from 'lucide-react';
import { cn } from '@lib/utils/cn';
import { getStrings, type ChatLanguage } from '@lib/ai/config';

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  isGenerating: boolean;
  isAtLimit: boolean;
  userMsgCount: number;
  maxMessages: number;
  language: ChatLanguage;
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
  language,
  inputRef,
  onSend,
  onStop,
  onClearChat,
}: ChatInputProps) {
  const strings = getStrings(language);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend(input);
    }
  };

  return (
    <div className="border-border/50 border-t px-4 py-3">
      <div className="mx-auto max-w-4xl">
        {isAtLimit ? (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <p className="text-text-secondary text-sm">{strings.limitReached(maxMessages)}</p>
            <button
              onClick={onClearChat}
              className="bg-accent text-bg-base hover:bg-accent-hover rounded-xl px-6 py-2.5 text-sm font-semibold transition-colors"
            >
              {strings.startNew}
            </button>
          </div>
        ) : (
          <>
            <div className="bg-bg-surface/80 border-accent/20 focus-within:border-accent/40 flex items-end gap-2 rounded-xl border px-4 py-3 backdrop-blur-sm transition-colors">
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
                placeholder={strings.placeholder}
                rows={1}
                className="text-text-primary placeholder:text-text-muted max-h-32 flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none"
                disabled={isGenerating}
                aria-label="Chat message input"
              />
              {isGenerating ? (
                <button
                  onClick={onStop}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-400 transition-colors hover:bg-red-500/20"
                  aria-label="Stop generating"
                >
                  <Square className="h-4 w-4 fill-current" />
                </button>
              ) : (
                <button
                  onClick={() => onSend(input)}
                  disabled={!input.trim()}
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all',
                    input.trim()
                      ? 'bg-accent text-bg-base hover:bg-accent-hover shadow-accent/30 shadow-lg'
                      : 'text-text-muted cursor-not-allowed',
                  )}
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="text-text-muted mt-2 px-1 text-[10px]">
              {strings.poweredBy}
              {userMsgCount > 0 && ` · ${userMsgCount}/${maxMessages}`}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
