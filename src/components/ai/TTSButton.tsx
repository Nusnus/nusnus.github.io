/**
 * TTSButton — Read aloud button for assistant messages.
 *
 * Uses the xAI TTS API via the Cloudflare Worker proxy to convert
 * assistant text to speech using the Rex voice.
 */

import { useState, useCallback, useRef } from 'react';
import { cn } from '@lib/utils/cn';
import { textToSpeech } from '@lib/cybernus/services/VoiceService';
import type { Language } from '@lib/ai/i18n';
import { t } from '@lib/ai/i18n';

interface TTSButtonProps {
  text: string;
  language: Language;
}

type TTSState = 'idle' | 'loading' | 'playing' | 'error';

export function TTSButton({ text, language }: TTSButtonProps) {
  const [state, setState] = useState<TTSState>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const strings = t(language);

  const handleClick = useCallback(async () => {
    if (state === 'playing') {
      audioRef.current?.pause();
      audioRef.current = null;
      abortRef.current?.abort();
      setState('idle');
      return;
    }

    if (state === 'loading') {
      abortRef.current?.abort();
      setState('idle');
      return;
    }

    try {
      setState('loading');
      const controller = new AbortController();
      abortRef.current = controller;

      // Strip markdown for cleaner TTS
      const cleanText = text
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/`[^`]+`/g, '')
        .replace(/```[\s\S]*?```/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/#{1,6}\s/g, '')
        .replace(/^\s*[>\-*]\s/gm, '')
        .trim();

      if (!cleanText) {
        setState('idle');
        return;
      }

      const audio = await textToSpeech(cleanText, controller.signal);
      audioRef.current = audio;

      audio.addEventListener(
        'ended',
        () => {
          setState('idle');
          audioRef.current = null;
        },
        { once: true },
      );

      audio.addEventListener(
        'error',
        () => {
          setState('error');
          audioRef.current = null;
        },
        { once: true },
      );

      await audio.play();
      setState('playing');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setState('idle');
      } else {
        setState('error');
        setTimeout(() => setState('idle'), 2000);
      }
    }
  }, [text, state]);

  return (
    <button
      onClick={handleClick}
      className={cn(
        'group inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] transition-all',
        state === 'playing'
          ? 'bg-[#00ff41]/10 text-[#00ff41]'
          : state === 'loading'
            ? 'animate-pulse text-white/30'
            : state === 'error'
              ? 'text-red-400'
              : 'text-white/20 hover:bg-white/5 hover:text-white/50',
      )}
      title={state === 'playing' ? strings.stopReading : strings.readAloud}
    >
      {state === 'playing' ? (
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="4" width="4" height="16" rx="1" />
          <rect x="14" y="4" width="4" height="16" rx="1" />
        </svg>
      ) : state === 'loading' ? (
        <svg
          className="h-3 w-3 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      ) : (
        <svg
          className="h-3 w-3"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
      )}
    </button>
  );
}
