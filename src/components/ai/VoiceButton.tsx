/**
 * Voice toggle button — starts/stops an xAI Voice Agent session.
 *
 * The session runs in the background; transcripts are posted back to the
 * parent via onUserSpeech / onAssistantSpeech so they can be appended to
 * the text chat as messages.
 */

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { startVoiceSession, type VoiceSession, type VoiceState } from '@lib/ai/voice';
import { cn } from '@lib/utils/cn';

interface VoiceButtonProps {
  /** System instructions for the voice agent (same prompt as text chat). */
  instructions: string;
  /** Called when the user finishes speaking (final transcript). */
  onUserSpeech: (text: string) => void;
  /** Called when the assistant finishes speaking. */
  onAssistantSpeech: (text: string) => void;
  disabled?: boolean;
}

export const VoiceButton = memo(function VoiceButton({
  instructions,
  onUserSpeech,
  onAssistantSpeech,
  disabled,
}: VoiceButtonProps) {
  const [state, setState] = useState<VoiceState>('idle');
  const sessionRef = useRef<VoiceSession | null>(null);
  const assistantFinalRef = useRef('');

  // Cleanup on unmount
  useEffect(() => () => sessionRef.current?.stop(), []);

  const handleClick = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.stop();
      sessionRef.current = null;
      // Flush any pending assistant transcript into the chat
      if (assistantFinalRef.current) {
        onAssistantSpeech(assistantFinalRef.current);
        assistantFinalRef.current = '';
      }
      return;
    }

    void startVoiceSession(instructions, {
      onStateChange: setState,
      onUserTranscript: (text) => {
        if (text.trim()) onUserSpeech(text);
      },
      onAssistantTranscript: (text, final) => {
        assistantFinalRef.current = text;
        if (final && text.trim()) {
          onAssistantSpeech(text);
          assistantFinalRef.current = '';
        }
      },
      onError: (msg) => {
        console.error('[Voice]', msg);
      },
    })
      .then((session) => {
        sessionRef.current = session;
      })
      .catch(() => {
        sessionRef.current = null;
      });
  }, [instructions, onUserSpeech, onAssistantSpeech]);

  const active = state === 'listening' || state === 'speaking';
  const connecting = state === 'connecting';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || connecting}
      aria-label={active ? 'Stop voice chat' : 'Start voice chat'}
      aria-pressed={active}
      title={
        state === 'error'
          ? 'Voice unavailable — click to retry'
          : active
            ? 'Voice chat active — click to stop'
            : 'Talk to Cybernus'
      }
      className={cn(
        'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all',
        active && 'bg-accent text-bg-base shadow-[0_0_12px_var(--color-accent)]',
        !active && !connecting && 'text-text-muted hover:text-text-primary hover:bg-bg-elevated',
        connecting && 'text-text-muted cursor-wait',
        disabled && 'cursor-not-allowed opacity-50',
        state === 'error' && 'text-red-400',
      )}
    >
      {connecting ? (
        <Loader2 className="size-4 animate-spin" />
      ) : active ? (
        <>
          <Mic className="size-4" />
          {state === 'speaking' && (
            <span className="bg-accent/40 absolute inset-0 animate-ping rounded-lg" />
          )}
        </>
      ) : state === 'error' ? (
        <MicOff className="size-4" />
      ) : (
        <Mic className="size-4" />
      )}
    </button>
  );
});
