/**
 * ChatComposer — the input area at the bottom of the chat.
 *
 * The parent injects text imperatively via a ref handle (`composer.seed(text)`)
 * rather than a prop — avoids the prop→state sync effect that trips
 * `react-hooks/set-state-in-effect` under React 19's stricter rules.
 */

import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import type { KeyboardEvent, SyntheticEvent } from 'react';

import type { CybernusLanguage } from '@lib/cybernus/context';
import { useSpeechInput } from '@lib/cybernus/voice';
import { cn } from '@lib/utils/cn';

export interface ChatComposerHandle {
  seed: (text: string) => void;
}

interface ChatComposerProps {
  onSend: (text: string) => void;
  onStop: () => void;
  streaming: boolean;
  language: CybernusLanguage;
}

const MAX_HEIGHT = 200;

const IconSend = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-4 w-4"
    aria-hidden="true"
  >
    <path d="m22 2-7 20-4-9-9-4Z" />
    <path d="M22 2 11 13" />
  </svg>
);
const IconSquare = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
    <rect x="5" y="5" width="14" height="14" rx="1" />
  </svg>
);
const IconMic = ({ active }: { active: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn('h-4 w-4', active && 'animate-pulse')}
    aria-hidden="true"
  >
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" x2="12" y1="19" y2="22" />
  </svg>
);

export const ChatComposer = memo(
  forwardRef<ChatComposerHandle, ChatComposerProps>(function ChatComposer(
    { onSend, onStop, streaming, language },
    ref,
  ) {
    const [value, setValue] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const speech = useSpeechInput(language, {
      onFinal: (text) => setValue((v) => (v ? v + ' ' : '') + text),
    });

    useImperativeHandle(
      ref,
      () => ({
        seed: (text: string) => {
          setValue(text);
          textareaRef.current?.focus();
        },
      }),
      [],
    );

    const autosize = useCallback(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
    }, []);

    useEffect(autosize, [value, speech.transcript, autosize]);

    const send = useCallback(() => {
      const text = value.trim();
      if (!text || streaming) return;
      onSend(text);
      setValue('');
    }, [value, streaming, onSend]);

    const onSubmit = useCallback(
      (e: SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        send();
      },
      [send],
    );

    const onKeyDown = useCallback(
      (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          send();
        }
      },
      [send],
    );

    const { listening: speechListening, start: speechStart, stop: speechStop } = speech;
    const toggleMic = useCallback(() => {
      if (speechListening) speechStop();
      else speechStart();
    }, [speechListening, speechStart, speechStop]);

    const displayValue =
      speech.listening && speech.transcript
        ? (value ? value + ' ' : '') + speech.transcript
        : value;

    const placeholder = language === 'es' ? 'Pregúntame lo que sea, parce…' : 'Ask me anything…';

    return (
      <form onSubmit={onSubmit} className="relative">
        <div className="border-border bg-bg-surface/80 focus-within:border-accent/50 flex items-end gap-2 rounded-2xl border p-2 backdrop-blur-sm transition-colors">
          <textarea
            ref={textareaRef}
            value={displayValue}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            rows={1}
            disabled={speech.listening}
            aria-label="Message Cybernus"
            className="scrollbar-thin text-text-primary placeholder:text-text-muted max-h-[200px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none disabled:opacity-70"
          />

          {speech.supported && (
            <button
              type="button"
              onClick={toggleMic}
              disabled={streaming}
              aria-label={speech.listening ? 'Stop listening' : 'Voice input'}
              aria-pressed={speech.listening}
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                speech.listening
                  ? 'bg-accent text-bg-base'
                  : 'text-text-muted hover:text-text-primary hover:bg-bg-elevated',
                'disabled:opacity-40',
              )}
            >
              <IconMic active={speech.listening} />
            </button>
          )}

          {streaming ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop generating"
              className="bg-bg-elevated text-text-primary hover:bg-border flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors"
            >
              <IconSquare />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!value.trim()}
              aria-label="Send message"
              className="bg-accent text-bg-base hover:bg-accent-hover disabled:bg-bg-elevated disabled:text-text-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors"
            >
              <IconSend />
            </button>
          )}
        </div>

        {speech.error && (
          <p className="text-status-warning mt-1 text-xs" role="alert">
            {speech.error}
          </p>
        )}
      </form>
    );
  }),
);
