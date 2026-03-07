import { type RefObject } from 'react';
import { Send, Square, Mic, MicOff } from 'lucide-react';
import { cn } from '@lib/utils/cn';
import type { Language } from '@lib/ai/i18n';
import { t } from '@lib/ai/i18n';

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  isGenerating: boolean;
  isAtLimit: boolean;
  userMsgCount: number;
  maxMessages: number;
  language: Language;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onSend: (text: string) => void;
  onStop: () => void;
  onClearChat: () => void;
  /** Voice state */
  isRecording?: boolean;
  onVoiceToggle?: () => void;
  voiceSupported?: boolean;
}

/** Chat input footer — textarea + send/stop + voice + message limit banner. */
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
  isRecording = false,
  onVoiceToggle,
  voiceSupported = false,
}: ChatInputProps) {
  const strings = t(language);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend(input);
    }
  };

  return (
    <div
      className="border-border/50 border-t px-4 py-3"
      style={{ background: 'rgba(0, 0, 0, 0.3)' }}
    >
      <div className="mx-auto max-w-2xl">
        {isAtLimit ? (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <p className="text-text-secondary text-sm">{strings.messageLimitReached}</p>
            <button
              onClick={onClearChat}
              className="rounded-xl bg-[#00ff41] px-6 py-2.5 text-sm font-semibold text-black transition-all hover:bg-[#00cc33] hover:shadow-[0_0_20px_rgba(0,255,65,0.3)]"
            >
              {strings.startNewChat}
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-end gap-2 rounded-xl border border-[#00ff41]/20 bg-black/40 px-4 py-3 transition-all focus-within:border-[#00ff41]/40 focus-within:shadow-[0_0_15px_rgba(0,255,65,0.1)]">
              {/* Voice button */}
              {voiceSupported && onVoiceToggle && (
                <button
                  onClick={onVoiceToggle}
                  disabled={isGenerating}
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all',
                    isRecording
                      ? 'bg-red-500/20 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.3)]'
                      : 'text-[#00ff41]/60 hover:bg-[#00ff41]/10 hover:text-[#00ff41]',
                  )}
                  aria-label={isRecording ? strings.voiceStop : strings.voiceStart}
                  title={isRecording ? strings.voiceStop : strings.voiceStart}
                >
                  {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
              )}

              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
                }}
                onKeyDown={handleKeyDown}
                placeholder={strings.placeholder}
                rows={1}
                className="max-h-32 flex-1 resize-none bg-transparent text-sm leading-relaxed text-[#00ff41] outline-none placeholder:text-[#00ff41]/30"
                disabled={isGenerating}
                dir={language === 'he' ? 'rtl' : 'ltr'}
                aria-label="Chat message input"
              />

              {isGenerating ? (
                <button
                  onClick={onStop}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-400 transition-colors hover:bg-red-500/20"
                  aria-label={strings.stop}
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
                      ? 'bg-[#00ff41] text-black hover:shadow-[0_0_15px_rgba(0,255,65,0.4)]'
                      : 'cursor-not-allowed text-[#00ff41]/20',
                  )}
                  aria-label={strings.send}
                >
                  <Send className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="mt-2 px-1 text-center text-[10px] text-[#00ff41]/30">
              {strings.poweredBy}
              {userMsgCount > 0 && ` · ${userMsgCount}/${maxMessages}`}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
