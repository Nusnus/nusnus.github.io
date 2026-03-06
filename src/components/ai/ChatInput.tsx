import { type RefObject, useState, useRef, useCallback } from 'react';
import { Send, Square, Mic, StopCircle } from 'lucide-react';
import { cn } from '@lib/utils/cn';
import { useLanguage } from '@hooks/useLanguage';

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
}

/** Chat input footer — textarea + send/stop + message limit banner. */
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
}: ChatInputProps) {
  // Translation hook
  const { t } = useLanguage();

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showVoiceConfirmation, setShowVoiceConfirmation] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend(input);
    }
  };

  /**
   * Start voice recording using MediaRecorder API.
   *
   * FUTURE INTEGRATION POINT: Eleven Labs Voice Synthesis
   * - This captures audio for potential voice chat features
   * - Audio blob can be sent to Eleven Labs API for voice synthesis
   * - Consider adding real-time streaming for lower latency
   * - May need to add voice activity detection (VAD)
   */
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);

      audioChunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        // FUTURE: Create audio blob and send to transcription service or Eleven Labs
        // const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // For now, just show confirmation
        setShowVoiceConfirmation(true);
        setTimeout(() => setShowVoiceConfirmation(false), 3000);

        // Clean up
        stream.getTracks().forEach((track) => track.stop());
        setRecordingTime(0);
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Start timer
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Unable to access microphone. Please check your browser permissions.');
    }
  }, []);

  /**
   * Stop voice recording.
   */
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  // Format recording time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="border-accent/20 from-bg-base to-bg-surface/30 relative border-t bg-gradient-to-t px-6 py-4 backdrop-blur-md lg:px-12">
      {/* Top glow line */}
      <div
        className="pointer-events-none absolute top-0 right-0 left-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, oklch(0.72 0.17 145 / 0.3) 50%, transparent)',
          boxShadow: '0 0 8px oklch(0.72 0.17 145 / 0.2)',
        }}
        aria-hidden="true"
      ></div>

      {/* Voice note confirmation banner */}
      {showVoiceConfirmation && (
        <div className="mx-auto mb-3 max-w-5xl animate-[message-slide-in_0.3s_ease-out]">
          <div className="bg-accent/10 ring-accent/30 flex items-center gap-2 rounded-lg px-4 py-2.5 ring-1">
            <Mic className="text-accent h-4 w-4" />
            <p className="text-accent font-mono text-sm">Voice note captured successfully</p>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-5xl">
        {isAtLimit ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="bg-accent/5 ring-accent/20 rounded-lg px-4 py-3 ring-1">
              <p className="text-accent font-mono text-sm font-medium">
                {t('sessionLimitReached')}
              </p>
              <p className="text-text-muted mt-1 text-xs">
                {t('maxMessagesPerSession', { count: maxMessages })}
              </p>
            </div>
            <button
              type="button"
              onClick={onClearChat}
              className="group from-accent to-accent/90 text-bg-base ring-accent/50 focus-visible:ring-accent focus-visible:ring-offset-bg-base relative overflow-hidden rounded-xl bg-gradient-to-r px-8 py-3 font-mono text-sm font-bold shadow-lg ring-1 transition-all duration-150 hover:shadow-[0_0_24px_oklch(0.72_0.17_145_/_0.4)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <span className="relative z-10">{t('initializeNewSession')}</span>
              <div
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, oklch(1 0 0 / 0.1) 50%, transparent)',
                }}
                aria-hidden="true"
              ></div>
            </button>
          </div>
        ) : (
          <>
            <div className="group border-accent/20 bg-bg-surface/50 ring-accent/10 focus-within:border-accent/40 focus-within:ring-accent/20 relative flex items-end gap-3 rounded-xl border px-5 py-4 shadow-lg ring-1 backdrop-blur-sm transition-all duration-150 focus-within:shadow-[0_0_24px_oklch(0.72_0.17_145_/_0.15)]">
              {/* Animated border glow on focus */}
              <div
                className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-150 group-focus-within:opacity-100"
                style={{
                  boxShadow: 'inset 0 0 12px oklch(0.72 0.17 145 / 0.1)',
                }}
                aria-hidden="true"
              ></div>

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
                placeholder={
                  isRecording ? `Recording... ${formatTime(recordingTime)}` : 'Enter your query...'
                }
                rows={1}
                className="text-text-primary placeholder:text-text-muted/60 relative z-10 max-h-32 flex-1 resize-none bg-transparent font-mono text-base leading-relaxed outline-none md:text-sm"
                disabled={isGenerating || isRecording}
                aria-label="Chat message input"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="sentences"
                spellCheck="true"
              />

              {/* Voice recording button */}
              {!isGenerating &&
                (isRecording ? (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="focus-visible:ring-offset-bg-surface relative z-10 flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-lg bg-red-500/10 text-red-400 ring-1 ring-red-500/30 transition-all duration-150 hover:bg-red-500/20 hover:shadow-[0_0_12px_oklch(0.5_0.2_25_/_0.3)] hover:ring-red-500/50 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-95"
                    aria-label="Stop recording"
                  >
                    <StopCircle className="h-5 w-5 animate-pulse fill-current" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startRecording}
                    disabled={!!input.trim()}
                    className={cn(
                      'relative z-10 flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-lg ring-1 transition-all duration-150 focus-visible:outline-none',
                      !input.trim()
                        ? 'bg-bg-elevated text-text-secondary ring-border hover:bg-bg-surface hover:text-accent focus-visible:ring-accent focus-visible:ring-offset-bg-surface focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-95'
                        : 'bg-bg-elevated text-text-muted ring-border cursor-not-allowed opacity-30',
                    )}
                    aria-label="Record voice note"
                    title="Record voice note (disabled when typing)"
                  >
                    <Mic className="h-5 w-5" />
                  </button>
                ))}

              {isGenerating ? (
                <button
                  type="button"
                  onClick={onStop}
                  className="focus-visible:ring-offset-bg-surface relative z-10 flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-lg bg-red-500/10 text-red-400 ring-1 ring-red-500/30 transition-all duration-150 hover:bg-red-500/20 hover:shadow-[0_0_12px_oklch(0.5_0.2_25_/_0.3)] hover:ring-red-500/50 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-95"
                  aria-label={t('stopGenerating')}
                >
                  <Square className="h-5 w-5 fill-current" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onSend(input)}
                  disabled={!input.trim()}
                  className={cn(
                    'relative z-10 flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-lg ring-1 transition-all duration-150 focus-visible:outline-none',
                    input.trim()
                      ? 'from-accent to-accent/90 text-bg-base ring-accent/50 focus-visible:ring-accent focus-visible:ring-offset-bg-surface bg-gradient-to-br shadow-lg hover:shadow-[0_0_20px_oklch(0.72_0.17_145_/_0.4)] focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-95'
                      : 'bg-bg-elevated text-text-muted ring-border cursor-not-allowed opacity-50',
                  )}
                  aria-label={t('sendMessage')}
                >
                  <Send className="h-5 w-5" />
                </button>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between px-1">
              <p className="text-text-muted font-mono text-[10px] tracking-wider uppercase">
                <span className="text-accent">xAI Grok</span> {t('neuralInterface')}
                {userMsgCount > 0 && (
                  <span className="ml-2 opacity-60">
                    · {userMsgCount}/{maxMessages} {t('queries')}
                  </span>
                )}
              </p>
              <p className="text-text-muted/60 text-[10px]">{t('responsesInaccurate')}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
