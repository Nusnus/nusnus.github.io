import { type RefObject } from 'react';
import { Square, Mic, ArrowUp } from 'lucide-react';
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

/** Voice waveform visualization — animated bars that react to audio level. */
function VoiceWaveform({ audioLevel }: { audioLevel: number }) {
  return (
    <div className="flex items-end gap-[3px]">
      {[0, 1, 2, 3, 4].map((i) => {
        const baseHeight = [10, 16, 20, 16, 10][i] ?? 10;
        const height = Math.max(4, baseHeight * (0.3 + audioLevel * 0.7));
        return (
          <div
            key={i}
            className="wave-bar bg-accent w-[3px] rounded-full transition-[height] duration-75"
            style={{
              height: `${height}px`,
              animationDelay: `${i * 0.12}s`,
              opacity: 0.5 + audioLevel * 0.5,
            }}
          />
        );
      })}
    </div>
  );
}

/** Floating chat input bar with voice integration. */
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
    <div className="shrink-0 px-4 pt-2 pb-4 md:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        {isAtLimit ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 py-4 text-center">
            <p className="text-text-secondary text-sm">{strings.messageLimitReached}</p>
            <button
              onClick={onClearChat}
              className="bg-accent text-bg-base hover:bg-accent-hover rounded-xl px-6 py-2 text-sm font-semibold transition-all"
            >
              {strings.startNewChat}
            </button>
          </div>
        ) : (
          <>
            {/* Recording indicator bar */}
            {isRecording && (
              <div className="cybernus-fade-in mb-2 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
                  <span className="text-xs font-medium text-red-400">{strings.recording}</span>
                </div>
                <VoiceWaveform audioLevel={audioLevel} />
                {transcriptPreview && (
                  <p className="min-w-0 flex-1 truncate text-sm text-red-300/70 italic">
                    {transcriptPreview}
                  </p>
                )}
                <button
                  onClick={onVoiceToggle}
                  className="shrink-0 rounded-lg bg-red-500/15 px-3 py-1 text-xs font-medium text-red-400 transition-all hover:bg-red-500/25"
                >
                  {strings.voiceStop}
                </button>
              </div>
            )}

            {/* Main input bar */}
            <div
              className={cn(
                'relative flex items-end gap-2 rounded-2xl border px-3 py-2 shadow-lg shadow-black/10 transition-all',
                isRecording
                  ? 'border-red-500/25 bg-red-500/[0.03]'
                  : 'border-border bg-bg-surface focus-within:border-accent/30 focus-within:shadow-accent/5',
              )}
            >
              {/* Voice button */}
              {voiceSupported && onVoiceToggle && !isRecording && (
                <button
                  onClick={onVoiceToggle}
                  disabled={isGenerating}
                  className="text-text-muted hover:text-accent hover:bg-accent-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all"
                  aria-label={strings.voiceStart}
                  title={strings.voiceStart}
                >
                  <Mic className="h-4 w-4" />
                </button>
              )}

              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
                }}
                onKeyDown={handleKeyDown}
                placeholder={isRecording ? strings.transcribing : strings.placeholder}
                rows={1}
                className={cn(
                  'max-h-40 min-h-[36px] flex-1 resize-none bg-transparent py-1.5 text-sm leading-relaxed outline-none',
                  isRecording
                    ? 'text-red-300/70 placeholder:text-red-400/20'
                    : 'text-text-primary placeholder:text-text-muted',
                )}
                disabled={isGenerating || isRecording}
                dir={language === 'he' ? 'rtl' : 'ltr'}
                aria-label="Chat message input"
              />

              {/* Send / Stop button */}
              {isGenerating ? (
                <button
                  onClick={onStop}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/15 text-red-400 transition-all hover:bg-red-500/25"
                  aria-label={strings.stop}
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                </button>
              ) : (
                <button
                  onClick={() => onSend(input)}
                  disabled={!input.trim()}
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all',
                    input.trim()
                      ? 'bg-accent text-bg-base hover:bg-accent-hover'
                      : 'bg-bg-elevated text-text-muted cursor-not-allowed',
                  )}
                  aria-label={strings.send}
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Footer info */}
            <div className="text-text-muted mt-2 flex items-center justify-center gap-2 text-[10px]">
              <span>{strings.poweredBy}</span>
              {userMsgCount > 0 && (
                <>
                  <span className="text-border">·</span>
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
