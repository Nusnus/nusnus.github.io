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
            className="wave-bar w-[3px] rounded-full bg-red-400 transition-[height] duration-75"
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
    // During recording: Esc cancels, Enter accepts and closes
    if (isRecording && onVoiceToggle) {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        onVoiceToggle();
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend(input);
    }
  };

  return (
    <div className="shrink-0 px-4 pt-2 pb-4 md:px-8 lg:px-12">
      <div className="mx-auto max-w-2xl">
        {isAtLimit ? (
          <div className="border-status-warning/20 bg-status-warning/[0.04] flex flex-col items-center gap-3 rounded-2xl border py-4 text-center backdrop-blur-sm">
            <p className="text-text-secondary text-sm">{strings.messageLimitReached}</p>
            <button
              onClick={onClearChat}
              className="bg-accent text-bg-base shadow-accent/20 hover:bg-accent-hover hover:shadow-accent/30 rounded-xl px-6 py-2 text-sm font-semibold shadow-lg transition-all"
            >
              {strings.startNewChat}
            </button>
          </div>
        ) : (
          <>
            {/* Recording indicator bar */}
            {isRecording && (
              <div className="cybernus-fade-in mb-2.5 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.04] px-4 py-3 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-50" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-400" />
                  </span>
                  <span className="text-xs font-medium text-red-400">{strings.recording}</span>
                </div>
                <VoiceWaveform audioLevel={audioLevel} />
                {transcriptPreview && (
                  <p className="min-w-0 flex-1 truncate text-sm text-red-300/60 italic">
                    {transcriptPreview}
                  </p>
                )}
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-[10px] text-red-400/50">Esc cancel · Enter send</span>
                  <button
                    onClick={onVoiceToggle}
                    className="shrink-0 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition-all hover:bg-red-500/20"
                  >
                    {strings.voiceStop}
                  </button>
                </div>
              </div>
            )}

            {/* Main input bar */}
            <div
              className={cn(
                'relative flex items-end gap-2 rounded-2xl border px-3 py-2.5 shadow-xl transition-all',
                isRecording
                  ? 'border-red-500/25 bg-red-500/[0.03] shadow-red-500/5'
                  : 'border-border bg-bg-surface focus-within:border-accent/30 focus-within:shadow-accent/5 shadow-black/20 backdrop-blur-sm',
              )}
            >
              {/* Voice button with Shift+Enter hint */}
              {voiceSupported && onVoiceToggle && !isRecording && (
                <button
                  onClick={onVoiceToggle}
                  disabled={isGenerating}
                  className="text-text-muted hover:bg-bg-elevated hover:text-accent group flex shrink-0 items-center gap-1.5 rounded-xl px-2 py-1.5 transition-all"
                  aria-label={strings.voiceStart}
                  title={strings.voiceStart}
                >
                  <Mic className="h-4 w-4" />
                  <span className="text-text-muted/50 group-hover:text-accent/60 text-[10px] whitespace-nowrap transition-colors">
                    Shift+Enter
                  </span>
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
                      ? 'bg-accent text-bg-base shadow-accent/20 hover:bg-accent-hover hover:shadow-accent/30 shadow-lg'
                      : 'bg-bg-elevated text-text-muted cursor-not-allowed',
                  )}
                  aria-label={strings.send}
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Footer info */}
            <div className="text-text-muted mt-2.5 flex items-center justify-center gap-2 text-[10px]">
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
