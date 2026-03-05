/**
 * Web Speech API wrapper — browser-native voice input.
 *
 * This is the "send voice notes" answer to the spec. xAI's native Voice
 * Agent needs a persistent WebSocket session (stateful, different billing
 * model); browser-native `SpeechRecognition` is free, stateless, and good
 * enough for dictation into a text box.
 *
 * Caveats:
 *   - Chrome/Edge only for now (Webkit prefix). Safari iOS supports it
 *     but Firefox does not — the hook degrades gracefully.
 *   - Recognition language is set from the UI language, not auto-detected.
 *     Spanish uses the Colombian locale.
 *   - Runs on-device on modern Chrome; older versions hit a Google server.
 *     Either way, the raw audio never touches our worker.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { CybernusLanguage } from './context';

/* ─── Vendor types ─── */
// The DOM lib doesn't ship SpeechRecognition types — they're vendor-prefixed.
// Define just enough surface for our usage. Scoped to this module.

interface SpeechRecognitionAlternative {
  transcript: string;
}
interface SpeechRecognitionResult {
  0: SpeechRecognitionAlternative;
  isFinal: boolean;
}
interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent {
  error: string;
}
interface SpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognition;

interface SpeechWindow {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
}

/* ─── Constants ─── */

/** BCP-47 locale per UI language. */
const LOCALE_BY_LANG: Record<CybernusLanguage, string> = {
  en: 'en-US',
  es: 'es-CO', // Cali, Colombia — matches persona's "parce" energy
};

/** User-presentable labels for the most common Web Speech error codes. */
const ERROR_LABELS: Record<string, string> = {
  'no-speech': 'No speech detected',
  'not-allowed': 'Microphone blocked',
  'service-not-allowed': 'Microphone blocked',
  'audio-capture': 'No microphone found',
  network: 'Network error',
  aborted: '', // intentional stop — don't surface
};

/**
 * Resolve the SpeechRecognition constructor if the browser supports it.
 *
 * Memoised at module scope — the answer is constant per realm, no point
 * re-probing `window` on every render. Server and client get separate
 * module instances, so caching `null` during SSR doesn't leak to the client.
 */
let _ctorCache: SpeechRecognitionCtor | null | undefined;
function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (_ctorCache !== undefined) return _ctorCache;
  if (typeof window === 'undefined') return (_ctorCache = null);
  const w = window as unknown as SpeechWindow;
  return (_ctorCache = w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null);
}

/* ─── Hook ─── */

/** Options for `useSpeechInput`. */
export interface SpeechInputOptions {
  /**
   * Called once when recognition ends with a non-empty final transcript.
   * This is the imperative event you want — consume the text here rather
   * than polling `transcript` from an effect (which would trip the
   * `react-hooks/set-state-in-effect` rule).
   */
  onFinal?: (transcript: string) => void;
}

/** Return value of `useSpeechInput`. */
export interface SpeechInput {
  /** True if the browser supports the Web Speech API. */
  supported: boolean;
  /** True while actively listening. */
  listening: boolean;
  /** Live transcript — interim results are included so the user sees words appear. */
  transcript: string;
  /** Last error message (empty string if none). */
  error: string;
  /** Start listening. No-op if unsupported or already listening. */
  start: () => void;
  /** Stop listening gracefully (keeps the final transcript). */
  stop: () => void;
}

/** No-op subscription for `useSyncExternalStore` — browser feature support never changes. */
const noopSubscribe = (): (() => void) => () => undefined;
/** Server snapshot — always unsupported (no `window` during SSR). */
const serverSupported = (): boolean => false;
/** Client snapshot for `supported` — module-scope so the identity is stable. */
const clientSupported = (): boolean => getRecognitionCtor() !== null;

/**
 * React hook wrapping the Web Speech API.
 *
 * The recognition instance is created lazily and re-created whenever the
 * language changes (the API doesn't support hot-swapping `lang`).
 */
export function useSpeechInput(
  language: CybernusLanguage,
  options?: SpeechInputOptions,
): SpeechInput {
  // Hydration safety: `supported` depends on `window`, which is absent during
  // SSR. `useSyncExternalStore` lets us return `false` for the server snapshot
  // and the real value on the client — React reconciles the difference without
  // a hydration mismatch (and without tripping `react-hooks/set-state-in-effect`).
  const supported = useSyncExternalStore(noopSubscribe, clientSupported, serverSupported);

  const recogRef = useRef<SpeechRecognition | null>(null);
  // Accumulate the transcript in a ref so the onend handler can read the
  // final value without depending on React state (avoids stale closures).
  const bufferRef = useRef('');
  // Latest onFinal callback — read through a ref so `start()` doesn't need to
  // re-bind handlers when the callback identity changes. Updated in an effect
  // (not during render) to satisfy `react-hooks/refs`; the one-render lag is
  // harmless here since `onend` fires asynchronously.
  const onFinalRef = useRef(options?.onFinal);
  useEffect(() => {
    onFinalRef.current = options?.onFinal;
  }, [options?.onFinal]);

  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');

  // Tear down on unmount or language change.
  useEffect(() => {
    return () => {
      recogRef.current?.abort();
      recogRef.current = null;
    };
  }, [language]);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor || recogRef.current) return;

    const r = new Ctor();
    r.lang = LOCALE_BY_LANG[language];
    r.continuous = false; // stop after a pause — better for chat composition
    r.interimResults = true; // stream words as they're heard

    r.onresult = (ev) => {
      // `ev.results` is cumulative — interim results update IN PLACE at the
      // same index, and the list only grows when a new utterance starts.
      // We must rebuild the full transcript from scratch on every event;
      // appending would duplicate every previously-seen interim word.
      // (SpeechRecognitionResultList is array-like, not iterable — hence Array.from.)
      const full = Array.from(ev.results, (r) => r[0].transcript).join('');
      bufferRef.current = full;
      setTranscript(full);
    };

    r.onerror = (ev) => {
      const label = ERROR_LABELS[ev.error] ?? `Speech error: ${ev.error}`;
      if (label) setError(label);
      setListening(false);
      recogRef.current = null;
      bufferRef.current = '';
    };

    r.onend = () => {
      // Fire the final-transcript callback BEFORE clearing state. This is
      // the handoff point — caller gets the text, we reset to idle.
      const final = bufferRef.current.trim();
      if (final) onFinalRef.current?.(final);
      setListening(false);
      setTranscript('');
      recogRef.current = null;
      bufferRef.current = '';
    };

    setError('');
    setTranscript('');
    bufferRef.current = '';
    setListening(true);
    recogRef.current = r;
    r.start();
  }, [language]);

  const stop = useCallback(() => {
    recogRef.current?.stop();
  }, []);

  return { supported, listening, transcript, error, start, stop };
}
