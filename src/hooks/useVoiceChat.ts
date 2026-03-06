/**
 * useVoiceChat — Voice input with live transcription via xAI Realtime API.
 *
 * Architecture:
 * 1. User clicks mic → AudioContext captures at 24kHz PCM16
 * 2. Ephemeral token fetched from Cloudflare Worker proxy
 * 3. WebSocket connects to xAI Realtime API using token
 * 4. Audio chunks are buffered until WebSocket is ready, then flushed
 * 5. Server-side VAD detects speech end → transcription is returned
 * 6. Transcription populates the input box for user review before sending
 *
 * Critical notes:
 * - DO NOT add input_audio_transcription config (xAI doesn't support it)
 * - DO NOT set connection state before WebSocket actually connects
 * - Buffer audio during connection establishment
 * - Clean up all resources (AudioContext, MediaStream, processor)
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { WORKER_REALTIME_URL } from '@config';

/* ─── Types ─── */

type VoiceState = 'idle' | 'connecting' | 'recording' | 'transcribing' | 'error';

interface VoiceDiagnostics {
  state: VoiceState;
  wsState: string;
  audioChunksBuffered: number;
  audioChunksSent: number;
  sampleRate: number;
  errorMessage: string | null;
  lastEvent: string | null;
}

interface UseVoiceChatReturn {
  /** Current voice state. */
  state: VoiceState;
  /** Latest transcript segment (only the newest piece, not cumulative). */
  transcript: string;
  /** Monotonically incrementing counter — changes each time a new segment arrives. */
  transcriptVersion: number;
  /** Start recording and transcription. */
  startRecording: () => void;
  /** Stop recording and finalize transcription. */
  stopRecording: () => void;
  /** Error message if state === 'error'. */
  errorMessage: string | null;
  /** Diagnostics for debugging. */
  diagnostics: VoiceDiagnostics;
}

/* ─── Audio helpers ─── */

const TARGET_SAMPLE_RATE = 24000;

/** Convert Float32 audio samples to base64-encoded PCM16. */
function float32ToPcm16Base64(float32: Float32Array): string {
  const pcm16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i] ?? 0));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(pcm16.buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/** Downsample audio from source rate to target rate. */
function downsample(buffer: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return buffer;
  const ratio = fromRate / toRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const srcIndex = Math.round(i * ratio);
    result[i] = buffer[srcIndex] ?? 0;
  }
  return result;
}

/* ─── Hook ─── */

export function useVoiceChat(): UseVoiceChatReturn {
  const [state, setState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [transcriptVersion, setTranscriptVersion] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Refs for non-React objects
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<AudioWorkletNode | ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioBufferRef = useRef<string[]>([]);
  const chunksSentRef = useRef(0);
  const lastEventRef = useRef<string | null>(null);
  const isRecordingRef = useRef(false);
  const cleanupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ─── Diagnostics ─── */
  const diagnostics: VoiceDiagnostics = {
    state,
    wsState: wsRef.current
      ? (['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][wsRef.current.readyState] ?? 'UNKNOWN')
      : 'NONE',
    audioChunksBuffered: audioBufferRef.current.length,
    audioChunksSent: chunksSentRef.current,
    sampleRate: audioContextRef.current?.sampleRate ?? 0,
    errorMessage,
    lastEvent: lastEventRef.current,
  };

  /* ─── Cleanup ─── */
  const cleanup = useCallback(() => {
    isRecordingRef.current = false;

    // Cancel any pending delayed cleanup from a previous stopRecording
    if (cleanupTimeoutRef.current) {
      clearTimeout(cleanupTimeoutRef.current);
      cleanupTimeoutRef.current = null;
    }

    // Stop audio processing
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    // Stop media stream tracks
    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        track.stop();
      }
      mediaStreamRef.current = null;
    }

    // Close AudioContext
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }

    // Close WebSocket
    if (wsRef.current) {
      if (
        wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING
      ) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }

    audioBufferRef.current = [];
    chunksSentRef.current = 0;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  /* ─── Send audio chunk via WebSocket ─── */
  const sendAudioChunk = useCallback((base64Audio: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: base64Audio,
        }),
      );
      chunksSentRef.current++;
    } else {
      // Buffer audio until WebSocket is ready
      audioBufferRef.current.push(base64Audio);
    }
  }, []);

  /* ─── Flush buffered audio ─── */
  const flushBuffer = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const buffered = audioBufferRef.current;
    audioBufferRef.current = [];
    for (const chunk of buffered) {
      ws.send(
        JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: chunk,
        }),
      );
      chunksSentRef.current++;
    }
  }, []);

  /* ─── Start recording ─── */
  const startRecording = useCallback(async () => {
    if (isRecordingRef.current) return;

    // Cancel any pending delayed cleanup from previous session
    if (cleanupTimeoutRef.current) {
      clearTimeout(cleanupTimeoutRef.current);
      cleanupTimeoutRef.current = null;
    }

    // Reset state
    cleanup();
    setTranscript('');
    setErrorMessage(null);
    setState('connecting');
    isRecordingRef.current = true;

    try {
      // 1. Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: TARGET_SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;

      if (!isRecordingRef.current) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }

      // 2. Set up audio context
      const audioContext = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      // Use ScriptProcessorNode (widely supported)
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        if (!isRecordingRef.current) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const resampled = downsample(inputData, audioContext.sampleRate, TARGET_SAMPLE_RATE);
        const base64 = float32ToPcm16Base64(resampled);
        sendAudioChunk(base64);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      // 3. Fetch ephemeral token
      const tokenRes = await fetch(WORKER_REALTIME_URL, { method: 'POST' });
      if (!tokenRes.ok) {
        throw new Error(`Failed to get voice token: ${tokenRes.status}`);
      }
      const tokenData = (await tokenRes.json()) as { client_secret?: { value?: string } };
      const token = tokenData.client_secret?.value;
      if (!token) {
        throw new Error('No ephemeral token in response');
      }

      if (!isRecordingRef.current) {
        cleanup();
        return;
      }

      // 4. Connect WebSocket to xAI Realtime API
      const ws = new WebSocket('wss://api.x.ai/v1/realtime', [`xai-client-secret.${token}`]);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isRecordingRef.current) {
          ws.close();
          return;
        }
        lastEventRef.current = 'ws.open';

        // Send session configuration
        ws.send(
          JSON.stringify({
            type: 'session.update',
            session: {
              modalities: ['text'],
              input_audio_format: 'pcm16',
              turn_detection: { type: 'server_vad' },
            },
          }),
        );

        setState('recording');
        // Flush any audio buffered during connection
        flushBuffer();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as Record<string, unknown>;
          const eventType = data.type as string;
          lastEventRef.current = eventType;

          if (eventType === 'conversation.item.input_audio_transcription.completed') {
            const transcriptText = data.transcript as string | undefined;
            if (transcriptText) {
              // Expose only the latest segment — consumer appends to input
              setTranscript(transcriptText);
              setTranscriptVersion((v) => v + 1);
            }
          } else if (eventType === 'input_audio_buffer.speech_started') {
            setState('recording');
          } else if (eventType === 'input_audio_buffer.speech_stopped') {
            setState('transcribing');
          } else if (eventType === 'error') {
            const errData = data.error as { message?: string } | undefined;
            console.error('[Voice] WebSocket error event:', errData?.message);
            setErrorMessage(errData?.message ?? 'Voice chat error');
            setState('error');
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onerror = () => {
        if (!isRecordingRef.current) return;
        console.error('[Voice] WebSocket error');
        setErrorMessage('Voice connection error');
        setState('error');
        cleanup();
      };

      ws.onclose = () => {
        lastEventRef.current = 'ws.close';
        if (isRecordingRef.current) {
          setState('idle');
          isRecordingRef.current = false;
        }
      };
    } catch (err) {
      console.error('[Voice] Start error:', err);
      const message =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone permission denied'
          : err instanceof Error
            ? err.message
            : 'Failed to start voice chat';
      setErrorMessage(message);
      setState('error');
      cleanup();
    }
  }, [cleanup, sendAudioChunk, flushBuffer]);

  /* ─── Stop recording ─── */
  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;

    // Tell xAI we're done sending audio
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
      // Cancel any previous pending cleanup timeout before setting a new one
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
      }
      // Wait a moment for final transcription before cleanup
      cleanupTimeoutRef.current = setTimeout(() => {
        cleanupTimeoutRef.current = null;
        cleanup();
        setState('idle');
      }, 2000);
    } else {
      cleanup();
      setState('idle');
    }
  }, [cleanup]);

  return {
    state,
    transcript,
    transcriptVersion,
    startRecording,
    stopRecording,
    errorMessage,
    diagnostics,
  };
}
