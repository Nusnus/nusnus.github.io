/**
 * xAI Voice Agent client — browser-side WebSocket.
 *
 * Flow:
 *   1. Ask the CF Worker for an ephemeral token (5-min TTL).
 *   2. Browser connects DIRECTLY to wss://api.x.ai/v1/realtime using the
 *      token in the sec-websocket-protocol header. No proxy — xAI handles CORS.
 *   3. Send session.update with voice + instructions + server-side VAD.
 *   4. Stream mic → PCM16 → base64 → input_audio_buffer.append.
 *      Server VAD handles turn detection (we don't need to commit manually).
 *   5. Receive response.output_audio.delta → decode PCM16 → play via WebAudio.
 *   6. Surface transcripts via callbacks so the main chat can show them.
 *
 * Clean shutdown on stop(): close mic stream, close AudioContext, close WS.
 */

import { WORKER_BASE_URL } from '@config';

const XAI_WS_URL = 'wss://api.x.ai/v1/realtime';
const TOKEN_ENDPOINT = `${WORKER_BASE_URL}/voice/token`;
const SAMPLE_RATE = 24000;

export type VoiceState = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error';

export interface VoiceCallbacks {
  onStateChange: (state: VoiceState) => void;
  /** Called with what the user said (final transcript). */
  onUserTranscript?: (text: string) => void;
  /** Called with the assistant's transcript chunks (streaming). */
  onAssistantTranscript?: (text: string, final: boolean) => void;
  onError: (message: string) => void;
}

/* ─── Audio helpers ─── */

/** Float32 [-1,1] → Int16LE → base64 */
function floatToPcm16Base64(float32: Float32Array): string {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i] ?? 0));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** base64 → Int16LE → Float32 [-1,1] */
function pcm16Base64ToFloat(b64: string): Float32Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) float32[i] = (int16[i] ?? 0) / 0x8000;
  return float32;
}

/* ─── Session ─── */

export interface VoiceSession {
  stop: () => void;
}

/**
 * Start a voice session. Resolves once the WS is open and the mic is live.
 * The returned `stop()` must be called to release the mic + audio context.
 */
export async function startVoiceSession(
  instructions: string,
  callbacks: VoiceCallbacks,
): Promise<VoiceSession> {
  callbacks.onStateChange('connecting');

  /* ── 1. Fetch ephemeral token ── */
  const tokenRes = await fetch(TOKEN_ENDPOINT, { method: 'POST' });
  if (!tokenRes.ok) {
    const msg = `Failed to get voice token (${tokenRes.status})`;
    callbacks.onError(msg);
    callbacks.onStateChange('error');
    throw new Error(msg);
  }
  const { token } = (await tokenRes.json()) as { token: string };

  /* ── 2. Connect to xAI WS directly ── */
  const ws = new WebSocket(XAI_WS_URL, [`xai-client-secret.${token}`]);

  /* ── 3. Audio context (shared for in + out) ── */
  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioCtx({ sampleRate: SAMPLE_RATE });

  /* Output playback queue — schedule chunks back-to-back */
  let playbackTime = 0;
  const scheduleChunk = (pcm: Float32Array) => {
    if (audioCtx.state === 'closed') return;
    const buffer = audioCtx.createBuffer(1, pcm.length, SAMPLE_RATE);
    // getChannelData().set() accepts ArrayLike<number> — avoids TS 5.7 strict
    // typed-array ArrayBuffer vs ArrayBufferLike variance on copyToChannel
    buffer.getChannelData(0).set(pcm);
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    const startAt = Math.max(audioCtx.currentTime, playbackTime);
    source.start(startAt);
    playbackTime = startAt + buffer.duration;
  };

  /* Input — mic → PCM16 */
  let micStream: MediaStream | null = null;
  let sourceNode: MediaStreamAudioSourceNode | null = null;
  let processorNode: ScriptProcessorNode | null = null;

  const attachMic = async () => {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: SAMPLE_RATE,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    sourceNode = audioCtx.createMediaStreamSource(micStream);
    // ScriptProcessorNode is deprecated but universally supported; AudioWorklet
    // setup is significantly heavier and this is a non-critical path.
    processorNode = audioCtx.createScriptProcessor(2048, 1, 1);
    processorNode.onaudioprocess = (e) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const input = e.inputBuffer.getChannelData(0);
      ws.send(
        JSON.stringify({ type: 'input_audio_buffer.append', audio: floatToPcm16Base64(input) }),
      );
    };
    sourceNode.connect(processorNode);
    processorNode.connect(audioCtx.destination); // required in some browsers to keep the graph alive
  };

  /* ── 4. Wire WS events ── */
  let assistantTranscript = '';

  ws.onopen = () => {
    // Configure the session: voice, instructions, server-side VAD, PCM @24kHz
    ws.send(
      JSON.stringify({
        type: 'session.update',
        session: {
          voice: 'Rex',
          instructions,
          turn_detection: { type: 'server_vad' },
          audio: {
            input: { format: { type: 'audio/pcm', rate: SAMPLE_RATE } },
            output: { format: { type: 'audio/pcm', rate: SAMPLE_RATE } },
          },
        },
      }),
    );
    // Start mic capture after session is configured
    void attachMic()
      .then(() => callbacks.onStateChange('listening'))
      .catch((err: unknown) => {
        callbacks.onError(err instanceof Error ? err.message : 'Microphone access denied');
        callbacks.onStateChange('error');
        ws.close();
      });
  };

  ws.onmessage = (event) => {
    let data: { type?: string; delta?: string; transcript?: string };
    try {
      data = JSON.parse(event.data as string) as typeof data;
    } catch {
      return;
    }
    switch (data.type) {
      case 'response.output_audio.delta':
        if (data.delta) {
          callbacks.onStateChange('speaking');
          scheduleChunk(pcm16Base64ToFloat(data.delta));
        }
        break;
      case 'response.output_audio_transcript.delta':
        if (data.delta) {
          assistantTranscript += data.delta;
          callbacks.onAssistantTranscript?.(assistantTranscript, false);
        }
        break;
      case 'response.output_audio_transcript.done':
        callbacks.onAssistantTranscript?.(assistantTranscript, true);
        assistantTranscript = '';
        break;
      case 'response.output_audio.done':
      case 'response.done':
        callbacks.onStateChange('listening');
        break;
      case 'input_audio_buffer.speech_started':
        // User started talking — server may cancel current TTS, so drop queued audio
        playbackTime = audioCtx.currentTime;
        callbacks.onStateChange('listening');
        break;
      case 'conversation.item.input_audio_transcription.completed':
        if (data.transcript) callbacks.onUserTranscript?.(data.transcript);
        break;
      case 'error': {
        const err = (data as { error?: { message?: string } }).error;
        callbacks.onError(err?.message ?? 'Voice session error');
        callbacks.onStateChange('error');
        break;
      }
      default:
        // session.created, session.updated, input_audio_buffer.* — ignore
        break;
    }
  };

  ws.onerror = () => {
    callbacks.onError('Voice connection failed');
    callbacks.onStateChange('error');
  };

  ws.onclose = () => {
    if (processorNode) processorNode.onaudioprocess = null;
  };

  /* ── 5. Cleanup ── */
  const stop = () => {
    try {
      processorNode?.disconnect();
      sourceNode?.disconnect();
      micStream?.getTracks().forEach((t) => t.stop());
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close();
      if (audioCtx.state !== 'closed') void audioCtx.close();
    } catch {
      /* best effort */
    }
    callbacks.onStateChange('idle');
  };

  return { stop };
}
