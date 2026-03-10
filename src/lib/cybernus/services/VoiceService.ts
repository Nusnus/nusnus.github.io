/**
 * VoiceService — voice input (Web Speech API) + voice output (xAI TTS + Realtime).
 *
 * Single Responsibility: Only handles voice I/O.
 * Three modes:
 *   1. Speech-to-text (Web Speech API, free, client-side)
 *   2. Text-to-speech (xAI TTS API via worker proxy)
 *   3. Live voice conversation (xAI Realtime WebSocket, 30s limit)
 */

import { WORKER_BASE_URL, CYBERNUS_VOICE_ID, VOICE_LIVE_LIMIT_SECONDS } from '../config';
import type { VoiceState } from '../types';

/* ── Web Speech API type shims ── */

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

/* ── Language mapping ── */

const LANG_MAP: Record<string, string> = { en: 'en', es: 'es', he: 'he' };

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
}

/** Check if browser supports speech recognition + mic. */
export function isVoiceSupported(): boolean {
  return !!getSpeechRecognitionCtor() && !!navigator.mediaDevices?.getUserMedia;
}

/* ── Speech-to-Text Session ── */

export interface STTCallbacks {
  onStateChange: (state: VoiceState) => void;
  onTranscript: (text: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onAudioLevel: (level: number) => void;
}

/**
 * Speech-to-text session using Web Speech API.
 * Free, client-side only. Used for voice input.
 */
export class STTSession {
  private callbacks: STTCallbacks;
  private recognition: SpeechRecognitionInstance | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private state: VoiceState = 'idle';
  private destroyed = false;
  private stopped = false;
  private lang: string;

  constructor(callbacks: STTCallbacks, language = 'en') {
    this.callbacks = callbacks;
    this.lang = LANG_MAP[language] ?? 'en';
  }

  async start(): Promise<void> {
    if (this.destroyed) return;
    this.stopped = false;

    try {
      this.setState('requesting-mic');
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });

      if (this.destroyed || this.stopped) {
        this.cleanup();
        return;
      }

      this.audioContext = new AudioContext();
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
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

      const Ctor = getSpeechRecognitionCtor();
      if (!Ctor) throw new Error('Speech recognition not supported');

      this.recognition = new Ctor();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = this.lang;
      this.recognition.maxAlternatives = 3;

      this.recognition.onstart = () => {
        this.setState('recording');
      };

      this.recognition.onresult = (event) => {
        let interim = '';
        let finalText = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (!result?.[0]) continue;
          if (result.isFinal) {
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
        if (interim) this.callbacks.onTranscript(interim, false);
        if (finalText) this.callbacks.onTranscript(finalText.trim(), true);
      };

      this.recognition.onerror = (event) => {
        if (event.error === 'aborted' || this.stopped || this.destroyed) return;
        const friendlyMessages: Record<string, string> = {
          'not-allowed': 'Microphone permission denied',
          'no-speech': 'No speech detected — try speaking louder',
          'audio-capture': 'No microphone found',
          network: 'Network error during speech recognition',
        };
        const message = friendlyMessages[event.error] ?? `Speech recognition error: ${event.error}`;
        if (event.error === 'no-speech') return;
        this.handleError(message);
      };

      this.recognition.onend = () => {
        if (!this.stopped && !this.destroyed && this.state === 'recording') {
          try {
            this.recognition?.start();
          } catch {
            /* already started */
          }
        }
      };

      this.recognition.start();
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone permission denied'
          : err instanceof DOMException && err.name === 'NotFoundError'
            ? 'No microphone found'
            : err instanceof Error
              ? err.message
              : 'Failed to start voice session';
      this.handleError(message);
    }
  }

  stop(): void {
    this.stopped = true;
    this.cleanup();
    this.setState('idle');
  }

  destroy(): void {
    this.destroyed = true;
    this.cleanup();
  }

  private setState(newState: VoiceState): void {
    this.state = newState;
    this.callbacks.onStateChange(newState);
  }

  private handleError(message: string): void {
    if (this.stopped || this.destroyed) return;
    this.setState('error');
    this.callbacks.onError(message);
    this.cleanup();
  }

  private cleanup(): void {
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        /* already stopped */
      }
      this.recognition = null;
    }
    if (this.processorNode) {
      this.processorNode.onaudioprocess = null;
      try {
        this.processorNode.disconnect();
      } catch {
        /* already disconnected */
      }
      this.processorNode = null;
    }
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {
        /* already disconnected */
      }
      this.sourceNode = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {
        /* ignore close errors */
      });
      this.audioContext = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
  }
}

/* ── Text-to-Speech (xAI TTS API) ── */

/**
 * Convert text to speech using xAI TTS API via the Cloudflare Worker proxy.
 * Returns an AudioBuffer that can be played immediately.
 */
export async function textToSpeech(text: string, signal?: AbortSignal): Promise<HTMLAudioElement> {
  const response = await fetch(`${WORKER_BASE_URL}/v1/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: text.slice(0, 4096),
      voice_id: CYBERNUS_VOICE_ID,
    }),
    signal: signal ?? null,
  });

  if (!response.ok) {
    throw new Error(`TTS request failed (${response.status})`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.addEventListener('ended', () => URL.revokeObjectURL(url), { once: true });
  return audio;
}

/* ── Live Voice (xAI Realtime WebSocket) ── */

export interface LiveVoiceCallbacks {
  onStateChange: (state: VoiceState) => void;
  onTranscript: (text: string, isFinal: boolean) => void;
  onAudioResponse: (audioData: ArrayBuffer) => void;
  onTextResponse: (text: string) => void;
  onError: (error: string) => void;
  onTimeUpdate: (elapsed: number, limit: number) => void;
  onTimeLimitReached: () => void;
}

/**
 * Live voice conversation session using xAI Realtime WebSocket API.
 * Limited to VOICE_LIVE_LIMIT_SECONDS per session.
 */
export class LiveVoiceSession {
  private callbacks: LiveVoiceCallbacks;
  private ws: WebSocket | null = null;
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private destroyed = false;
  private startTime = 0;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private systemPrompt: string;

  constructor(callbacks: LiveVoiceCallbacks, systemPrompt: string) {
    this.callbacks = callbacks;
    this.systemPrompt = systemPrompt;
  }

  async start(): Promise<void> {
    if (this.destroyed) return;

    try {
      this.callbacks.onStateChange('connecting');

      // Get ephemeral token from worker
      const tokenRes = await fetch(`${WORKER_BASE_URL}/v1/realtime/client_secrets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!tokenRes.ok) throw new Error('Failed to get voice session token');
      const tokenData = (await tokenRes.json()) as { client_secret?: { value?: string } };
      const token = tokenData.client_secret?.value;
      if (!token) throw new Error('Invalid token response');

      // Request mic
      this.callbacks.onStateChange('requesting-mic');
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 24000 },
      });

      if (this.destroyed) {
        this.cleanup();
        return;
      }

      // Connect WebSocket
      this.ws = new WebSocket('wss://api.x.ai/v1/realtime', [`xai-client-secret.${token}`]);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        // Configure session
        this.ws?.send(
          JSON.stringify({
            type: 'session.update',
            session: {
              model: 'grok-4-1-fast',
              voice: CYBERNUS_VOICE_ID,
              instructions: this.systemPrompt,
              input_audio_format: 'pcm16',
              output_audio_format: 'pcm16',
              turn_detection: { type: 'server_vad' },
            },
          }),
        );

        this.callbacks.onStateChange('connected');
        this.startTime = Date.now();
        this.startTimer();
        this.startAudioCapture();
      };

      this.ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          this.handleServerEvent(JSON.parse(event.data) as Record<string, unknown>);
        }
      };

      this.ws.onerror = () => {
        this.callbacks.onError('Voice connection error');
        this.cleanup();
      };

      this.ws.onclose = () => {
        this.callbacks.onStateChange('idle');
        this.cleanup();
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start live voice';
      this.callbacks.onError(message);
      this.cleanup();
    }
  }

  stop(): void {
    this.cleanup();
    this.callbacks.onStateChange('idle');
  }

  destroy(): void {
    this.destroyed = true;
    this.cleanup();
  }

  private startTimer(): void {
    this.timerInterval = setInterval(() => {
      const elapsed = (Date.now() - this.startTime) / 1000;
      this.callbacks.onTimeUpdate(elapsed, VOICE_LIVE_LIMIT_SECONDS);
      if (elapsed >= VOICE_LIVE_LIMIT_SECONDS) {
        this.callbacks.onTimeLimitReached();
        this.stop();
      }
    }, 100);
  }

  private startAudioCapture(): void {
    if (!this.mediaStream) return;

    this.audioContext = new AudioContext({ sampleRate: 24000 });
    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.processorNode.onaudioprocess = (e: AudioProcessingEvent) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      const inputData = e.inputBuffer.getChannelData(0);
      const pcm16 = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i] ?? 0));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      this.ws.send(
        JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer))),
        }),
      );
    };

    this.sourceNode.connect(this.processorNode);
    this.processorNode.connect(this.audioContext.destination);
  }

  private handleServerEvent(event: Record<string, unknown>): void {
    const type = event.type as string;

    if (type === 'response.audio.delta') {
      const audioB64 = event.delta as string;
      if (audioB64) {
        const binary = atob(audioB64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        this.callbacks.onAudioResponse(bytes.buffer);
      }
    } else if (type === 'response.audio_transcript.delta') {
      const text = event.delta as string;
      if (text) this.callbacks.onTextResponse(text);
    } else if (type === 'conversation.item.input_audio_transcription.completed') {
      const transcript = event.transcript as string;
      if (transcript) this.callbacks.onTranscript(transcript, true);
    } else if (type === 'error') {
      const errMsg =
        ((event.error as Record<string, unknown>)?.message as string) ?? 'Unknown error';
      this.callbacks.onError(errMsg);
    }
  }

  private cleanup(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
    if (this.processorNode) {
      this.processorNode.onaudioprocess = null;
      try {
        this.processorNode.disconnect();
      } catch {
        /* ignore */
      }
      this.processorNode = null;
    }
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {
        /* ignore */
      }
      this.sourceNode = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {
        /* ignore close errors */
      });
      this.audioContext = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
  }
}
