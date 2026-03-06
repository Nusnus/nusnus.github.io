import { type RefObject, useEffect, useRef } from 'react';
import { Mic, MicOff, Send, Square } from 'lucide-react';
import { cn } from '@lib/utils/cn';
import type { Language } from '@lib/ai/config';
import { getTranslations } from '@lib/ai/i18n';
import { useVoiceChat } from '@hooks/useVoiceChat';

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  isGenerating: boolean;
  isAtLimit: boolean;
  userMsgCount: number;
  maxMessages: number;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onSend: (text: string) => void;
  onStop: () => void;
  onClearChat: () => void;
  language: Language;
}

/** Chat input footer — textarea + mic + send/stop + message limit banner. */
export function ChatInput({
  input,
  setInput,
  isGenerating,
  isAtLimit,
  userMsgCount,
  maxMessages,
  inputRef,
  onSend,
  onStop,
  onClearChat,
  language,
}: ChatInputProps) {
  const t = getTranslations(language);
  const voice = useVoiceChat();
  const inputValueRef = useRef(input);
  inputValueRef.current = input;

  // When a new transcript segment arrives, append it to input
  useEffect(() => {
    if (voice.transcript && voice.transcriptVersion > 0) {
      const current = inputValueRef.current;
      setInput(current ? `${current} ${voice.transcript}` : voice.transcript);
    }
    // React to new segments only (version bump)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.transcriptVersion]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend(input);
    }
  };

  const isVoiceActive =
    voice.state === 'connecting' || voice.state === 'recording' || voice.state === 'transcribing';

  const handleMicClick = () => {
    if (isVoiceActive) {
      voice.stopRecording();
    } else {
      voice.startRecording();
    }
  };

  return (
    <div className="border-t border-green-500/20 bg-gradient-to-t from-[#0a0f0a] to-transparent px-4 py-3">
      <div className="mx-auto max-w-2xl">
        {isAtLimit ? (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <p className="text-text-secondary text-sm">{t.messageLimitReached}</p>
            <button
              onClick={onClearChat}
              className="rounded-xl bg-green-500 px-6 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-green-400"
            >
              {t.newChat}
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-end gap-2 rounded-xl border border-green-500/20 bg-[#0a120a] px-4 py-3">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
                }}
                onKeyDown={handleKeyDown}
                placeholder={
                  isVoiceActive
                    ? voice.state === 'connecting'
                      ? t.connecting
                      : voice.state === 'transcribing'
                        ? t.transcribing
                        : t.startRecording
                    : t.askPlaceholder
                }
                rows={1}
                className="text-text-primary placeholder:text-text-muted max-h-32 flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none"
                disabled={isGenerating}
                aria-label={t.sendMessage}
                dir={language === 'he' ? 'rtl' : 'ltr'}
              />

              {/* Mic button */}
              {!isGenerating && (
                <button
                  onClick={handleMicClick}
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all',
                    isVoiceActive
                      ? 'animate-pulse bg-red-500/20 text-red-400 hover:bg-red-500/30'
                      : 'text-text-muted hover:bg-green-500/10 hover:text-green-400',
                  )}
                  aria-label={isVoiceActive ? t.stopRecording : t.startRecording}
                  title={isVoiceActive ? t.stopRecording : t.startRecording}
                >
                  {isVoiceActive ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
              )}

              {/* Send / Stop button */}
              {isGenerating ? (
                <button
                  onClick={onStop}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-400 transition-colors hover:bg-red-500/20"
                  aria-label={t.stopGenerating}
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
                      ? 'bg-green-500 text-black shadow-[0_0_12px_rgba(34,197,94,0.3)] hover:bg-green-400'
                      : 'text-text-muted cursor-not-allowed',
                  )}
                  aria-label={t.sendMessage}
                >
                  <Send className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Voice error */}
            {voice.state === 'error' && voice.errorMessage && (
              <p className="mt-1 px-1 text-[10px] text-red-400">{voice.errorMessage}</p>
            )}

            <p className="text-text-muted mt-2 px-1 text-[10px]">
              {t.poweredBy}
              {userMsgCount > 0 && ` · ${userMsgCount}/${maxMessages}`}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
