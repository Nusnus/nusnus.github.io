/**
 * ChatInput — Input area with textarea, voice mic, and send/stop controls.
 *
 * Matrix-inspired terminal aesthetic with neon green accents.
 */
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
    <div className="border-t border-emerald-500/10 bg-[#0a0a0a]/80 px-6 py-3 backdrop-blur-sm">
      <div className="mx-auto max-w-5xl">
        {isAtLimit ? (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <p className="font-mono text-xs text-emerald-700">{t.messageLimitReached}</p>
            <button
              onClick={onClearChat}
              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-6 py-2.5 font-mono text-xs font-semibold text-emerald-400 shadow-lg shadow-emerald-500/10 transition-all hover:border-emerald-500/50 hover:bg-emerald-500/20 hover:shadow-emerald-500/20"
            >
              {t.startNewChat}
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-end gap-2 rounded-lg border border-emerald-500/15 bg-black/60 px-4 py-3 transition-all focus-within:border-emerald-500/40 focus-within:shadow-lg focus-within:shadow-emerald-500/5">
              {/* Terminal prompt indicator */}
              <span className="mb-0.5 shrink-0 font-mono text-sm font-bold text-emerald-600">
                {'>'}
              </span>

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
                        : t.recording
                    : t.askPlaceholder
                }
                rows={1}
                className="max-h-32 flex-1 resize-none bg-transparent font-mono text-sm leading-relaxed text-emerald-100 outline-none placeholder:text-emerald-800"
                disabled={isGenerating}
                aria-label={t.sendMessage}
                dir={language === 'he' ? 'rtl' : 'ltr'}
              />

              {/* Mic button */}
              {!isGenerating && (
                <button
                  onClick={handleMicClick}
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-all',
                    isVoiceActive
                      ? 'animate-pulse bg-red-500/20 text-red-400 shadow-lg shadow-red-500/10 hover:bg-red-500/30'
                      : 'text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-400',
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
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-red-500/10 text-red-400 transition-all hover:bg-red-500/20"
                  aria-label={t.stopGenerating}
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                </button>
              ) : (
                <button
                  onClick={() => onSend(input)}
                  disabled={!input.trim()}
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-all',
                    input.trim()
                      ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-sm shadow-emerald-500/10 hover:bg-emerald-500/20 hover:shadow-emerald-500/20'
                      : 'cursor-not-allowed text-emerald-900',
                  )}
                  aria-label={t.sendMessage}
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Voice error */}
            {voice.state === 'error' && voice.errorMessage && (
              <p className="mt-1.5 px-1 font-mono text-[10px] text-red-400">{voice.errorMessage}</p>
            )}

            <p className="mt-2 px-1 font-mono text-[9px] text-emerald-900">
              {t.poweredBy}
              {userMsgCount > 0 && ` · ${userMsgCount}/${maxMessages}`}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
