/**
 * Voice chat — live transcription via xAI Realtime API.
 *
 * Audio capture at 24kHz PCM16 → WebSocket via Cloudflare Worker proxy.
 * Server-side VAD handles automatic transcription.
 *
 * Critical implementation notes:
 * - DO NOT add input_audio_transcription to session config
 * - DO NOT set connection state before WebSocket actually connects
 * - DO buffer audio chunks until WebSocket is ready
 * - DO flush buffered audio after connection established
 * - DO clean up AudioContext, MediaStream, processor on unmount
 * - DO handle WebSocket reconnection with exponential backoff
 */

import { WORKER_BASE_URL } from '@config';

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
  wsReadyState: number | null;
  audioContextState: string | null;
  sampleRate: number | null;
  bufferedChunks: number;
  totalChunksSent: number;
  totalEventsReceived: number;
  lastEventType: string | null;
  lastError: string | null;
  reconnectAttempts: number;
  connectionStartedAt: number | null;
  connectionEstablishedAt: number | null;
}

export interface VoiceCallbacks {
  onStateChange: (state: VoiceState) => void;
  onTranscript: (text: string, isFinal: boolean) => void;
  onDiagnosticsUpdate: (diag: VoiceDiagnostics) => void;
  onError: (error: string) => void;
  onAudioLevel: (level: number) => void;
}

/* ── Constants ── */

const TARGET_SAMPLE_RATE = 24000;
const RECONNECT_MAX_ATTEMPTS = 3;
const RECONNECT_BASE_DELAY_MS = 1000;
const XAI_REALTIME_WS_URL = 'wss://api.x.ai/v1/realtime';

/* ── Float32 → PCM16 conversion ── */

function float32ToPCM16(float32: Float32Array): ArrayBuffer {
  const pcm16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i] ?? 0));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return pcm16.buffer;
}

/* ── Resample audio to target sample rate ── */

function resample(audioData: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return audioData;
  const ratio = fromRate / toRate;
  const newLength = Math.round(audioData.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio;
    const srcFloor = Math.floor(srcIndex);
    const srcCeil = Math.min(srcFloor + 1, audioData.length - 1);
    const frac = srcIndex - srcFloor;
    result[i] = (audioData[srcFloor] ?? 0) * (1 - frac) + (audioData[srcCeil] ?? 0) * frac;
  }
  return result;
}

/* ── ArrayBuffer → base64 ── */

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(binary);
}

/**
 * Voice chat session manager.
 *
 * Manages the full lifecycle: mic permission → audio capture → WebSocket →
 * transcription events. Properly buffers audio during connection establishment
 * and flushes after connection is ready.
 */
export class VoiceSession {
  private callbacks: VoiceCallbacks;
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private state: VoiceState = 'idle';
  private audioBuffer: string[] = [];
  private isWsReady = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private stopped = false;
  private transcript = '';

  // Diagnostics
  private totalChunksSent = 0;
  private totalEventsReceived = 0;
  private lastEventType: string | null = null;
  private lastError: string | null = null;
  private connectionStartedAt: number | null = null;
  private connectionEstablishedAt: number | null = null;

  constructor(callbacks: VoiceCallbacks) {
    this.callbacks = callbacks;
  }

  /** Start a voice recording session. */
  async start(): Promise<void> {
    if (this.destroyed) return;
    this.stopped = false;
    this.transcript = '';
    this.audioBuffer = [];
    this.totalChunksSent = 0;
    this.totalEventsReceived = 0;
    this.lastEventType = null;
    this.lastError = null;
    this.reconnectAttempts = 0;

    try {
      // Step 1: Request microphone
      this.setState('requesting-mic');
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: TARGET_SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // Bail out if stop() or destroy() was called while awaiting getUserMedia
      if (this.destroyed || this.stopped) {
        this.cleanup();
        return;
      }

      // Step 2: Set up audio capture
      this.audioContext = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Using ScriptProcessorNode (AudioWorklet would be preferred but requires
      // a separate file served over HTTPS). Buffer size 4096 at 24kHz = ~170ms chunks.
      this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);
      this.processorNode.onaudioprocess = (e: AudioProcessingEvent) => {
        if (this.state !== 'recording' && this.state !== 'connecting') return;

        const inputData = e.inputBuffer.getChannelData(0);

        // Calculate audio level for visualization
        let sum = 0;
        for (const sample of inputData) {
          sum += sample * sample;
        }
        const rms = Math.sqrt(sum / inputData.length);
        this.callbacks.onAudioLevel(Math.min(1, rms * 5));

        // Resample if needed and convert to PCM16
        const resampled = resample(
          inputData,
          this.audioContext?.sampleRate ?? TARGET_SAMPLE_RATE,
          TARGET_SAMPLE_RATE,
        );
        const pcm16 = float32ToPCM16(resampled);
        const base64 = arrayBufferToBase64(pcm16);

        if (this.isWsReady) {
          this.sendAudioChunk(base64);
        } else {
          // Buffer audio until WebSocket is ready
          this.audioBuffer.push(base64);
          this.updateDiagnostics();
        }
      };

      this.sourceNode.connect(this.processorNode);
      this.processorNode.connect(this.audioContext.destination);

      // Bail out if stop() or destroy() was called during audio setup
      if (this.destroyed || this.stopped) {
        this.cleanup();
        return;
      }

      // Step 3: Connect WebSocket (audio is buffered until ready)
      this.setState('connecting');
      await this.connectWebSocket();
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone permission denied'
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

  /** Destroy the session permanently. */
  destroy(): void {
    this.destroyed = true;
    this.cleanup();
  }

  /** Get current diagnostics snapshot. */
  getDiagnostics(): VoiceDiagnostics {
    return {
      state: this.state,
      wsReadyState: this.ws?.readyState ?? null,
      audioContextState: this.audioContext?.state ?? null,
      sampleRate: this.audioContext?.sampleRate ?? null,
      bufferedChunks: this.audioBuffer.length,
      totalChunksSent: this.totalChunksSent,
      totalEventsReceived: this.totalEventsReceived,
      lastEventType: this.lastEventType,
      lastError: this.lastError,
      reconnectAttempts: this.reconnectAttempts,
      connectionStartedAt: this.connectionStartedAt,
      connectionEstablishedAt: this.connectionEstablishedAt,
    };
  }

  /* ── Private Methods ── */

  private setState(newState: VoiceState): void {
    this.state = newState;
    this.callbacks.onStateChange(newState);
    this.updateDiagnostics();
  }

  private updateDiagnostics(): void {
    this.callbacks.onDiagnosticsUpdate(this.getDiagnostics());
  }

  private async connectWebSocket(): Promise<void> {
    if (this.destroyed) return;

    this.connectionStartedAt = Date.now();
    this.isWsReady = false;

    try {
      // Get ephemeral token from worker proxy
      this.log('Fetching ephemeral token from worker...');
      const tokenRes = await fetch(`${WORKER_BASE_URL}/v1/realtime/client_secrets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!tokenRes.ok) {
        const errorBody = await tokenRes.text().catch(() => '');
        throw new Error(
          `Failed to get ephemeral token (${tokenRes.status}): ${errorBody || 'Unknown error'}`,
        );
      }

      const tokenData = (await tokenRes.json()) as { client_secret?: { value?: string } };
      const token = tokenData.client_secret?.value;

      if (!token) {
        throw new Error('Invalid token response: missing client_secret.value');
      }

      // Bail out if stop() or destroy() was called while awaiting token
      if (this.destroyed || this.stopped) return;

      this.log('Ephemeral token obtained, connecting to xAI Realtime API...');

      // Connect WebSocket directly to xAI Realtime API using sec-websocket-protocol
      // for browser-compatible auth (browsers can't set Authorization headers on WebSocket)
      this.ws = new WebSocket(XAI_REALTIME_WS_URL, [`xai-client-secret.${token}`]);

      this.ws.onopen = () => {
        // DO NOT set state to connected yet — wait for session.created event
        this.log('WebSocket opened, waiting for session.created...');

        // Send session configuration matching xAI's expected format
        this.ws?.send(
          JSON.stringify({
            type: 'session.update',
            session: {
              modalities: ['text'],
              voice: 'Sal',
              instructions: 'Transcribe the user audio input. Return the transcription as text.',
              audio: {
                input: {
                  format: { type: 'audio/pcm', rate: TARGET_SAMPLE_RATE },
                },
              },
              turn_detection: {
                type: 'server_vad',
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 500,
              },
            },
          }),
        );
      };

      this.ws.onmessage = (event: MessageEvent) => {
        this.totalEventsReceived++;
        try {
          const data = JSON.parse(event.data as string) as { type: string; [key: string]: unknown };
          this.lastEventType = data.type;
          this.handleRealtimeEvent(data);
        } catch {
          this.log('Failed to parse WebSocket message');
        }
        this.updateDiagnostics();
      };

      this.ws.onerror = () => {
        this.log('WebSocket error');
        this.handleError('WebSocket connection error');
      };

      this.ws.onclose = (event: CloseEvent) => {
        this.log(`WebSocket closed: code=${event.code} reason=${event.reason}`);
        this.isWsReady = false;

        if (this.state === 'recording' || this.state === 'connecting') {
          this.attemptReconnect();
        }
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'WebSocket connection failed';
      this.handleError(message);
    }
  }

  private handleRealtimeEvent(event: { type: string; [key: string]: unknown }): void {
    switch (event.type) {
      case 'session.created':
      case 'session.updated':
        // NOW the connection is truly ready
        this.isWsReady = true;
        this.connectionEstablishedAt = Date.now();
        this.setState('recording');

        // Flush buffered audio
        if (this.audioBuffer.length > 0) {
          this.log(`Flushing ${this.audioBuffer.length} buffered audio chunks`);
          for (const chunk of this.audioBuffer) {
            this.sendAudioChunk(chunk);
          }
          this.audioBuffer = [];
        }
        break;

      case 'conversation.item.input_audio_transcription.completed': {
        const transcript = (event.transcript as string) ?? '';
        if (transcript.trim()) {
          this.transcript = transcript.trim();
          this.callbacks.onTranscript(this.transcript, true);
        }
        break;
      }

      case 'conversation.item.input_audio_transcription.delta': {
        const delta = (event.delta as string) ?? '';
        if (delta) {
          this.transcript += delta;
          this.callbacks.onTranscript(this.transcript, false);
        }
        break;
      }

      case 'input_audio_buffer.speech_started':
        this.setState('recording');
        break;

      case 'input_audio_buffer.speech_stopped':
        this.setState('transcribing');
        break;

      case 'input_audio_buffer.committed':
        // Audio was committed for processing
        this.log('Audio buffer committed');
        break;

      case 'response.audio_transcript.delta': {
        // Server-side transcription delta
        const delta = (event.delta as string) ?? '';
        if (delta) {
          this.transcript += delta;
          this.callbacks.onTranscript(this.transcript, false);
        }
        break;
      }

      case 'response.audio_transcript.done': {
        const transcript = (event.transcript as string) ?? '';
        if (transcript.trim()) {
          this.transcript = transcript.trim();
          this.callbacks.onTranscript(this.transcript, true);
        }
        break;
      }

      case 'response.text.delta': {
        // Text response delta (for transcription via text modality)
        const delta = (event.delta as string) ?? '';
        if (delta) {
          this.transcript += delta;
          this.callbacks.onTranscript(this.transcript, false);
        }
        break;
      }

      case 'response.text.done': {
        // Text response complete
        const text = (event.text as string) ?? '';
        if (text.trim()) {
          this.transcript = text.trim();
          this.callbacks.onTranscript(this.transcript, true);
        }
        break;
      }

      case 'response.done':
        // Response fully complete — reset transcript for next utterance
        this.transcript = '';
        this.setState('recording');
        break;

      case 'error': {
        const errorMsg =
          ((event.error as Record<string, unknown>)?.message as string) ?? 'Unknown error';
        this.log(`API error: ${errorMsg}`);
        this.lastError = errorMsg;
        // Don't crash on non-fatal errors
        if (errorMsg.includes('invalid') || errorMsg.includes('unsupported')) {
          this.log(`Non-fatal API error: ${errorMsg}`);
        } else {
          this.handleError(errorMsg);
        }
        break;
      }

      default:
        this.log(`Unhandled event: ${event.type}`);
    }
  }

  private sendAudioChunk(base64Audio: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(
      JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: base64Audio,
      }),
    );
    this.totalChunksSent++;
  }

  private attemptReconnect(): void {
    if (this.destroyed || this.reconnectAttempts >= RECONNECT_MAX_ATTEMPTS) {
      this.handleError('Connection lost. Maximum reconnection attempts reached.');
      return;
    }

    this.reconnectAttempts++;
    const delay = RECONNECT_BASE_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1);
    this.log(
      `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${RECONNECT_MAX_ATTEMPTS})`,
    );

    this.setState('connecting');
    this.reconnectTimer = setTimeout(() => {
      this.connectWebSocket();
    }, delay);
  }

  private handleError(message: string): void {
    if (this.stopped || this.destroyed) return;
    this.lastError = message;
    this.setState('error');
    this.callbacks.onError(message);
    this.cleanup();
  }

  private cleanup(): void {
    // Clear reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Disconnect processor
    if (this.processorNode) {
      this.processorNode.onaudioprocess = null;
      try {
        this.processorNode.disconnect();
      } catch {
        // Already disconnected
      }
      this.processorNode = null;
    }

    // Disconnect source
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

    // Stop media stream tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    // Close WebSocket
    if (this.ws) {
      this.isWsReady = false;
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }

    // Clear buffer
    this.audioBuffer = [];
  }

  private log(message: string): void {
    console.log(`[VoiceSession] ${message}`);
  }
}
