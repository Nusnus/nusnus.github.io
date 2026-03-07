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
  /** Audio level 0-1 for waveform visualization. */
  audioLevel?: number;
  /** Live transcription preview text. */
  transcriptPreview?: string;
}

/** Voice waveform visualization bars. */
function VoiceWaveform({ audioLevel }: { audioLevel: number }) {
  const bars = 5;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: bars }).map((_, i) => {
        const delay = i * 0.1;
        const height = Math.max(4, audioLevel * 24 * (1 - Math.abs(i - 2) * 0.2));
        return (
          <div
            key={i}
            className="w-[3px] rounded-full bg-red-400 transition-all duration-100"
            style={{
              height: `${height}px`,
              opacity: 0.5 + audioLevel * 0.5,
              animationDelay: `${delay}s`,
            }}
          />
        );
      })}
    </div>
  );
}

/** Chat input footer — full-width modern design with voice waveform. */
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
  audioLevel = 0,
  transcriptPreview,
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
      className="border-t border-[#00ff41]/8 px-4 py-3 backdrop-blur-sm md:px-8 lg:px-12"
      style={{ background: 'rgba(0, 0, 0, 0.4)' }}
    >
      <div className="mx-auto max-w-4xl">
        {isAtLimit ? (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <p className="text-sm text-gray-400">{strings.messageLimitReached}</p>
            <button
              onClick={onClearChat}
              className="rounded-xl bg-[#00ff41] px-6 py-2.5 text-sm font-semibold text-black transition-all hover:bg-[#00cc33] hover:shadow-[0_0_20px_rgba(0,255,65,0.3)]"
            >
              {strings.startNewChat}
            </button>
          </div>
        ) : (
          <>
            {/* Transcript preview overlay */}
            {isRecording && transcriptPreview && (
              <div className="cybernus-fade-in mb-2 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2 text-sm text-red-300/80">
                <span className="mr-2 text-[10px] font-medium tracking-wider text-red-400/60 uppercase">
                  {strings.transcribing}
                </span>
                {transcriptPreview}
              </div>
            )}

            <div
              className={cn(
                'flex items-end gap-3 rounded-2xl border bg-black/30 px-4 py-3 transition-all',
                isRecording
                  ? 'border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.1)]'
                  : 'border-[#00ff41]/15 focus-within:border-[#00ff41]/35 focus-within:shadow-[0_0_20px_rgba(0,255,65,0.08)]',
              )}
            >
              {/* Voice button with waveform */}
              {voiceSupported && onVoiceToggle && (
                <div className="relative shrink-0">
                  <button
                    onClick={onVoiceToggle}
                    disabled={isGenerating}
                    className={cn(
                      'relative flex h-10 w-10 items-center justify-center rounded-xl transition-all',
                      isRecording
                        ? 'bg-red-500/20 text-red-400'
                        : 'text-[#00ff41]/50 hover:bg-[#00ff41]/10 hover:text-[#00ff41]',
                    )}
                    aria-label={isRecording ? strings.voiceStop : strings.voiceStart}
                    title={isRecording ? strings.voiceStop : strings.voiceStart}
                  >
                    {isRecording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                    {/* Pulsing ring animation when recording */}
                    {isRecording && (
                      <>
                        <span className="voice-ring absolute inset-0 rounded-xl border-2 border-red-500/40" />
                        <span className="voice-ring absolute inset-0 rounded-xl border-2 border-red-500/20 [animation-delay:0.5s]" />
                      </>
                    )}
                  </button>
                  {/* Waveform bars next to mic */}
                  {isRecording && (
                    <div className="absolute top-1/2 -right-1 translate-x-full -translate-y-1/2">
                      <VoiceWaveform audioLevel={audioLevel} />
                    </div>
                  )}
                </div>
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
                placeholder={isRecording ? strings.recording : strings.placeholder}
                rows={1}
                className={cn(
                  'max-h-32 flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none',
                  isRecording
                    ? 'text-red-300/80 placeholder:text-red-400/30'
                    : 'text-[#00ff41] placeholder:text-[#00ff41]/25',
                )}
                disabled={isGenerating || isRecording}
                dir={language === 'he' ? 'rtl' : 'ltr'}
                aria-label="Chat message input"
              />

              {/* Send / Stop button */}
              {isGenerating ? (
                <button
                  onClick={onStop}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/15 text-red-400 transition-all hover:bg-red-500/25 hover:shadow-[0_0_12px_rgba(239,68,68,0.2)]"
                  aria-label={strings.stop}
                >
                  <Square className="h-4 w-4 fill-current" />
                </button>
              ) : (
                <button
                  onClick={() => onSend(input)}
                  disabled={!input.trim()}
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all',
                    input.trim()
                      ? 'bg-[#00ff41] text-black shadow-[0_0_15px_rgba(0,255,65,0.2)] hover:shadow-[0_0_25px_rgba(0,255,65,0.4)]'
                      : 'cursor-not-allowed text-[#00ff41]/15',
                  )}
                  aria-label={strings.send}
                >
                  <Send className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Footer info */}
            <div className="mt-2 flex items-center justify-center gap-2 px-1 text-[10px] text-[#00ff41]/25">
              <span>{strings.poweredBy}</span>
              {userMsgCount > 0 && (
                <>
                  <span className="text-[#00ff41]/10">·</span>
                  <span>
                    {userMsgCount}/{maxMessages}
                  </span>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
