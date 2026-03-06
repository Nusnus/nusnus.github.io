/**
 * ChatInput — Input footer with textarea, voice mic, and send/stop controls.
 *
 * Features:
 * - Modern glassmorphic input area
 * - Voice recording with visual feedback
 * - Live transcript appended to input
 * - Wide-screen layout matching ChatMessages
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
    <div className="border-t border-white/[0.06] bg-gradient-to-t from-[#0b0d14] via-[#0d0f18]/95 to-transparent px-4 py-3">
      <div className="mx-auto max-w-4xl">
        {isAtLimit ? (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <p className="text-sm text-gray-400">{t.messageLimitReached}</p>
            <button
              onClick={onClearChat}
              className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:shadow-cyan-500/30"
            >
              {t.startNewChat}
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-end gap-2 rounded-2xl border border-white/[0.08] bg-[#12141f]/80 px-4 py-3 backdrop-blur-sm transition-all focus-within:border-cyan-500/30 focus-within:shadow-lg focus-within:shadow-cyan-500/5">
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
                className="max-h-32 flex-1 resize-none bg-transparent text-sm leading-relaxed text-gray-100 outline-none placeholder:text-gray-500"
                disabled={isGenerating}
                aria-label={t.sendMessage}
                dir={language === 'he' ? 'rtl' : 'ltr'}
              />

              {/* Mic button */}
              {!isGenerating && (
                <button
                  onClick={handleMicClick}
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all',
                    isVoiceActive
                      ? 'animate-pulse bg-red-500/20 text-red-400 shadow-lg shadow-red-500/10 hover:bg-red-500/30'
                      : 'text-gray-500 hover:bg-white/[0.06] hover:text-cyan-400',
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
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-400 transition-all hover:bg-red-500/20"
                  aria-label={t.stopGenerating}
                >
                  <Square className="h-4 w-4 fill-current" />
                </button>
              ) : (
                <button
                  onClick={() => onSend(input)}
                  disabled={!input.trim()}
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all',
                    input.trim()
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30'
                      : 'cursor-not-allowed text-gray-600',
                  )}
                  aria-label={t.sendMessage}
                >
                  <Send className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Voice error */}
            {voice.state === 'error' && voice.errorMessage && (
              <p className="mt-1.5 px-1 text-[10px] text-red-400">{voice.errorMessage}</p>
            )}

            <p className="mt-2 px-1 text-[10px] text-gray-500">
              {t.poweredBy}
              {userMsgCount > 0 && ` · ${userMsgCount}/${maxMessages}`}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
