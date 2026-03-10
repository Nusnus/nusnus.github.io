/**
 * Voice output — text-to-speech for Cybernus responses.
 *
 * Uses the browser-native SpeechSynthesis API for real-time TTS.
 * Supports multiple languages matching the chat i18n system.
 * Designed to be upgradable to xAI Realtime API in the future.
 */

import type { Language } from './i18n';

/* ─── Types ─── */

export type TTSState = 'idle' | 'speaking' | 'paused';

export interface TTSOptions {
  /** Language for voice selection. */
  language: Language;
  /** Speech rate (0.5-2.0, default 1.0). */
  rate?: number | undefined;
  /** Speech pitch (0-2.0, default 1.0). */
  pitch?: number | undefined;
}

/* ─── Language voice mapping ─── */

const VOICE_LANG_MAP: Record<Language, string[]> = {
  en: ['en-US', 'en-GB', 'en'],
  es: ['es-CO', 'es-MX', 'es-419', 'es-ES', 'es'],
  he: ['he-IL', 'he'],
};

/** Check if TTS is supported in the current browser. */
export function isTTSSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Find the best voice for the given language. */
function findVoice(language: Language): SpeechSynthesisVoice | null {
  if (!isTTSSupported()) return null;

  const voices = window.speechSynthesis.getVoices();
  const preferredLangs = VOICE_LANG_MAP[language] ?? ['en-US'];

  // Try each preferred language tag in order
  for (const lang of preferredLangs) {
    // Prefer non-local (network) voices for better quality
    const networkVoice = voices.find((v) => v.lang.startsWith(lang) && !v.localService);
    if (networkVoice) return networkVoice;

    const localVoice = voices.find((v) => v.lang.startsWith(lang));
    if (localVoice) return localVoice;
  }

  // Fallback to any English voice
  return voices.find((v) => v.lang.startsWith('en')) ?? voices[0] ?? null;
}

/** Strip markdown formatting for cleaner TTS output. */
function stripMarkdown(text: string): string {
  return (
    text
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, '')
      // Remove inline code
      .replace(/`[^`]+`/g, '')
      // Remove bold/italic markers
      .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
      // Remove heading markers
      .replace(/^#{1,6}\s+/gm, '')
      // Remove links, keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove images
      .replace(/!\[.*?\]\(.*?\)/g, '')
      // Remove HTML tags
      .replace(/<[^>]+>/g, '')
      // Remove mermaid blocks
      .replace(/```mermaid[\s\S]*?```/g, '')
      // Remove follow-up suggestions (→ prefixed lines)
      .replace(/^→\s+.*$/gm, '')
      // Collapse multiple newlines
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

/**
 * Speak the given text using the browser's SpeechSynthesis API.
 * Returns a promise that resolves when speech is complete.
 */
export function speak(
  text: string,
  options: TTSOptions,
  onStateChange?: (state: TTSState) => void,
): { cancel: () => void; promise: Promise<void> } {
  const cleanText = stripMarkdown(text);

  if (!isTTSSupported() || !cleanText) {
    return {
      cancel: () => {
        /* no-op when TTS is unsupported */
      },
      promise: Promise.resolve(),
    };
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(cleanText);
  const voice = findVoice(options.language);
  if (voice) utterance.voice = voice;
  utterance.rate = options.rate ?? 1.0;
  utterance.pitch = options.pitch ?? 1.0;

  const promise = new Promise<void>((resolve) => {
    utterance.onstart = () => onStateChange?.('speaking');
    utterance.onend = () => {
      onStateChange?.('idle');
      resolve();
    };
    utterance.onerror = () => {
      onStateChange?.('idle');
      resolve();
    };
    utterance.onpause = () => onStateChange?.('paused');
    utterance.onresume = () => onStateChange?.('speaking');

    window.speechSynthesis.speak(utterance);
  });

  return {
    cancel: () => {
      window.speechSynthesis.cancel();
      onStateChange?.('idle');
    },
    promise,
  };
}

/** Stop any ongoing TTS playback. */
export function stopSpeaking(): void {
  if (isTTSSupported()) {
    window.speechSynthesis.cancel();
  }
}
