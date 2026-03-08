/**
 * Voice input — live transcription via Web Speech API.
 *
 * Uses the browser-native SpeechRecognition API for real-time speech-to-text.
 * Audio level monitoring via AudioContext for waveform visualization.
 *
 * Browser support: Chrome, Edge, Safari (desktop + mobile).
 * No backend or API key required — runs entirely client-side.
 */

/* ── Web Speech API type shims (not in all TS DOM libs) ── */

interface SpeechRecognitionResultItem {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionResultItem | undefined;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult | undefined;
}

interface SpeechRecognitionEventShim extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEventShim extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEventShim) => void) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionErrorEventShim) => void) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

/* ── Types ── */

export type VoiceState =
  | 'idle'
  | 'requesting-mic'
  | 'connecting'
  | 'connected'
  | 'recording'
  | 'transcribing'
  | 'error';

export interface VoiceDiagnostics {
  state: VoiceState;
  audioContextState: string | null;
  sampleRate: number | null;
  lastError: string | null;
  recognitionLang: string | null;
}

export interface VoiceCallbacks {
  onStateChange: (state: VoiceState) => void;
  onTranscript: (text: string, isFinal: boolean) => void;
  onDiagnosticsUpdate: (diag: VoiceDiagnostics) => void;
  onError: (error: string) => void;
  onAudioLevel: (level: number) => void;
}

/* ── Language mapping for SpeechRecognition ── */

// Use broad language codes (no region) so the recognizer adapts to any accent.
// Regional codes like 'en-US' bias recognition toward American pronunciation,
// which fails for non-American speakers. Broad codes ('en', 'es', 'he') let
// the browser's speech engine pick the best acoustic model automatically.
const LANG_MAP: Record<string, string> = {
  en: 'en',
  es: 'es',
  he: 'he',
};

/* ── SpeechRecognition constructor (webkit prefix for Safari/older Chrome) ── */

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
}

/** Check if the browser supports speech recognition + mic access. */
export function isVoiceSupported(): boolean {
  return !!getSpeechRecognitionCtor() && !!navigator.mediaDevices?.getUserMedia;
}

/**
 * Voice input session using Web Speech API.
 *
 * Lifecycle: mic permission → audio level monitoring → speech recognition.
 * Provides live interim transcripts and final confirmed text.
 */
export class VoiceSession {
  private callbacks: VoiceCallbacks;
  private recognition: SpeechRecognitionInstance | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private state: VoiceState = 'idle';
  private destroyed = false;
  private stopped = false;
  private lastError: string | null = null;
  private lang: string;

  constructor(callbacks: VoiceCallbacks, language = 'en') {
    this.callbacks = callbacks;
    this.lang = LANG_MAP[language] ?? 'en-US';
  }

  /** Start a voice recording + transcription session. */
  async start(): Promise<void> {
    if (this.destroyed) return;
    this.stopped = false;
    this.lastError = null;

    try {
      // Step 1: Request microphone access
      this.setState('requesting-mic');

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });

      if (this.destroyed || this.stopped) {
        this.cleanup();
        return;
      }

      // Step 2: Set up audio level monitoring for waveform visualization
      this.audioContext = new AudioContext();
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

      // ScriptProcessorNode for audio level (AudioWorklet needs separate HTTPS-served file)
      this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);
      this.processorNode.onaudioprocess = (e: AudioProcessingEvent) => {
        if (this.state !== 'recording') return;
        const inputData = e.inputBuffer.getChannelData(0);
        let sum = 0;
        for (const sample of inputData) {
          sum += sample * sample;
        }
        const rms = Math.sqrt(sum / inputData.length);
        this.callbacks.onAudioLevel(Math.min(1, rms * 5));
      };
      this.sourceNode.connect(this.processorNode);
      this.processorNode.connect(this.audioContext.destination);

      if (this.destroyed || this.stopped) {
        this.cleanup();
        return;
      }

      // Step 3: Start Web Speech API recognition
      const Ctor = getSpeechRecognitionCtor();
      if (!Ctor) {
        throw new Error('Speech recognition is not supported in this browser');
      }

      this.recognition = new Ctor();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = this.lang;
      // More alternatives = better chance of correct transcription for accented speech
      this.recognition.maxAlternatives = 3;

      this.recognition.onstart = () => {
        this.log('Speech recognition started');
        this.setState('recording');
      };

      this.recognition.onresult = (event) => {
        let interim = '';
        let finalText = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (!result?.[0]) continue;

          if (result.isFinal) {
            // Pick the alternative with the highest confidence score.
            // With maxAlternatives > 1, the browser returns multiple
            // guesses — the best one isn't always at index 0 for
            // non-native/accented speakers.
            let bestTranscript = result[0].transcript;
            let bestConfidence = result[0].confidence;
            for (let j = 1; j < result.length; j++) {
              const alt = result[j];
              if (alt && alt.confidence > bestConfidence) {
                bestTranscript = alt.transcript;
                bestConfidence = alt.confidence;
              }
            }
            finalText += bestTranscript;
          } else {
            interim += result[0].transcript;
          }
        }

        if (interim) {
          this.callbacks.onTranscript(interim, false);
        }
        if (finalText) {
          this.callbacks.onTranscript(finalText.trim(), true);
        }
      };

      this.recognition.onerror = (event) => {
        // 'aborted' fires when we intentionally call stop()/abort() — ignore it
        if (event.error === 'aborted' || this.stopped || this.destroyed) return;

        const friendlyMessages: Record<string, string> = {
          'not-allowed': 'Microphone permission denied',
          'no-speech': 'No speech detected — try speaking louder',
          'audio-capture': 'No microphone found. Check your audio settings.',
          network: 'Network error during speech recognition',
        };

        const message = friendlyMessages[event.error] ?? `Speech recognition error: ${event.error}`;

        // 'no-speech' is non-fatal — just log and keep recording
        if (event.error === 'no-speech') {
          this.log(message);
          return;
        }

        this.handleError(message);
      };

      this.recognition.onend = () => {
        // Browser auto-stops recognition after silence or timeout — restart if still active
        if (!this.stopped && !this.destroyed && this.state === 'recording') {
          this.log('Recognition auto-ended, restarting...');
          try {
            this.recognition?.start();
          } catch {
            // Already started or recognition was aborted
          }
        }
      };

      this.recognition.start();
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone permission denied'
          : err instanceof DOMException && err.name === 'NotFoundError'
            ? 'No microphone found. Check your audio settings.'
            : err instanceof Error
              ? err.message
              : 'Failed to start voice session';
      this.handleError(message);
    }
  }

  /** Stop the current voice session and clean up resources. */
  stop(): void {
    this.stopped = true;
    this.cleanup();
    this.setState('idle');
  }

  /** Destroy the session permanently (called on component unmount). */
  destroy(): void {
    this.destroyed = true;
    this.cleanup();
  }

  /** Get current diagnostics snapshot. */
  getDiagnostics(): VoiceDiagnostics {
    return {
      state: this.state,
      audioContextState: this.audioContext?.state ?? null,
      sampleRate: this.audioContext?.sampleRate ?? null,
      lastError: this.lastError,
      recognitionLang: this.lang,
    };
  }

  /* ── Private Methods ── */

  private setState(newState: VoiceState): void {
    this.state = newState;
    this.callbacks.onStateChange(newState);
    this.callbacks.onDiagnosticsUpdate(this.getDiagnostics());
  }

  private handleError(message: string): void {
    if (this.stopped || this.destroyed) return;
    this.lastError = message;
    this.log(`Error: ${message}`);
    this.setState('error');
    this.callbacks.onError(message);
    this.cleanup();
  }

  private cleanup(): void {
    // Stop speech recognition
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // Already stopped
      }
      this.recognition = null;
    }

    // Disconnect audio processor
    if (this.processorNode) {
      this.processorNode.onaudioprocess = null;
      try {
        this.processorNode.disconnect();
      } catch {
        // Already disconnected
      }
      this.processorNode = null;
    }

    // Disconnect audio source
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {
        // Already disconnected
      }
      this.sourceNode = null;
    }

    // Close AudioContext
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {
        // Ignore close errors
      });
      this.audioContext = null;
    }

    // Stop media stream tracks (releases mic indicator)
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
  }

  private log(message: string): void {
    console.log(`[VoiceSession] ${message}`);
  }
}
