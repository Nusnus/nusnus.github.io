/**
 * VideoChatPlayer — cinema-style video + TTS voiceover player.
 *
 * Renders a full-width video with synchronized TTS audio overlay.
 * Auto-plays when both video and audio are ready. Shows a subtle
 * spoken-text caption overlay during playback.
 *
 * Performance: progress bar updates use direct DOM manipulation
 * via refs — no React re-renders during playback. Video/audio
 * elements are properly cleaned up on unmount to release memory.
 *
 * After playback completes, the ask_user options appear below.
 */

import { useState, useCallback, useRef, useEffect, memo } from 'react';
import { VideoChatLoader } from './VideoChatLoader';

interface VideoChatPlayerProps {
  /** URL of the generated video. */
  videoUrl: string;
  /** Object URL of the TTS audio for voiceover. */
  audioUrl?: string | undefined;
  /** The spoken text (displayed as caption during playback). */
  spokenText?: string | undefined;
  /** Whether the video is still being generated (show loading state). */
  isLoading?: boolean | undefined;
  /** Called when playback finishes (video + audio both done). */
  onPlaybackComplete?: (() => void) | undefined;
}

/** Cinema-style video player with synchronized TTS voiceover. */
export const VideoChatPlayer = memo(function VideoChatPlayer({
  videoUrl,
  audioUrl,
  spokenText,
  isLoading = false,
  onPlaybackComplete,
}: VideoChatPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [audioReady, setAudioReady] = useState(!audioUrl);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [showCaption, setShowCaption] = useState(false);
  const playbackCompleteRef = useRef(false);

  // Reset audioReady when audioUrl prop transitions from undefined → value
  // (TTS finishes after initial render). This ensures auto-play waits for TTS.
  const [prevAudioUrl, setPrevAudioUrl] = useState(audioUrl);
  if (audioUrl !== prevAudioUrl) {
    setPrevAudioUrl(audioUrl);
    setAudioReady(!audioUrl);
    // If the video already auto-played without audio, reset so it re-triggers
    if (audioUrl && hasPlayed) {
      setHasPlayed(false);
      setIsPlaying(false);
    }
  }

  // Progress bar update via direct DOM manipulation + requestAnimationFrame.
  // This avoids React re-renders during playback (~60 FPS updates go straight to DOM).
  // The RAF loop runs only while isPlaying is true.
  useEffect(() => {
    if (!isPlaying) return;

    let id = 0;
    const tick = () => {
      const video = videoRef.current;
      const audio = audioRef.current;
      const bar = progressRef.current;
      if (!video || !bar) return;

      const audioDur = audio?.duration || 0;
      const videoDur = video.duration || 0;
      const maxDur = Math.max(videoDur, audioDur) || videoDur;

      if (maxDur > 0) {
        const current = audioDur > videoDur ? (audio?.currentTime ?? 0) : video.currentTime;
        const pct = Math.min(current / maxDur, 1) * 100;
        bar.style.width = `${pct}%`;
      }

      id = requestAnimationFrame(tick);
    };

    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [isPlaying]);

  // Auto-play when both video and audio are ready
  useEffect(() => {
    if (videoReady && audioReady && !hasPlayed && !isLoading) {
      const video = videoRef.current;
      const audio = audioRef.current;

      // Reset completion flag so checkComplete fires again after replay
      playbackCompleteRef.current = false;

      const playBoth = async () => {
        try {
          // Start video (muted — the TTS audio is the voice track)
          if (video) {
            video.muted = true;
            await video.play();
          }
          // Start TTS audio
          if (audio) {
            await audio.play();
          }
          setIsPlaying(true);
          setShowCaption(true);
        } catch {
          // Auto-play blocked — pause video too so the manual play
          // button shows cleanly (video may already be playing muted).
          if (video) video.pause();
          setIsPlaying(false);
        }
      };

      playBoth();
    }
  }, [videoReady, audioReady, hasPlayed, isLoading]);

  // Clean up media elements on unmount to release memory.
  // Reads refs at cleanup time so it always captures the mounted elements,
  // regardless of when isLoading transitions.
  useEffect(() => {
    return () => {
      const video = videoRef.current;
      const audio = audioRef.current;
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load(); // forces resource release
      }
      if (audio) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
    };
  }, []);

  // Revoke TTS blob URL when it changes or on unmount.
  useEffect(() => {
    const currentAudioUrl = audioUrl;
    return () => {
      if (currentAudioUrl && currentAudioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(currentAudioUrl);
      }
    };
  }, [audioUrl]);

  // Handle playback completion
  const checkComplete = useCallback(() => {
    if (playbackCompleteRef.current) return;
    const video = videoRef.current;
    const audio = audioRef.current;

    const videoEnded = video ? video.ended : true;
    const audioEnded = audio ? audio.ended : true;

    if (videoEnded && audioEnded) {
      playbackCompleteRef.current = true;
      // Set progress bar to 100% directly
      if (progressRef.current) progressRef.current.style.width = '100%';
      setIsPlaying(false);
      setHasPlayed(true);
      setShowCaption(false);
      onPlaybackComplete?.();
    }
  }, [onPlaybackComplete]);

  const handleVideoEnd = useCallback(() => {
    // If TTS audio is still playing, loop the video so it doesn't freeze
    // on the last frame. The video keeps playing until audio finishes.
    const audio = audioRef.current;
    if (audio && !audio.ended && !audio.paused) {
      const video = videoRef.current;
      if (video) {
        video.currentTime = 0;
        video.play().catch(() => {
          /* ignore */
        });
        return; // Don't check completion yet — audio is still going
      }
    }
    checkComplete();
  }, [checkComplete]);

  const handleAudioEnd = useCallback(() => {
    setShowCaption(false);
    // Pause the (possibly looping) video so it doesn't keep playing after
    // the voiceover is done, then mark playback as complete.
    const video = videoRef.current;
    if (video && !video.ended) {
      video.pause();
    }
    playbackCompleteRef.current = true;
    // Set progress bar to 100% directly
    if (progressRef.current) progressRef.current.style.width = '100%';
    setIsPlaying(false);
    setHasPlayed(true);
    onPlaybackComplete?.();
  }, [onPlaybackComplete]);

  // Manual play (when auto-play is blocked)
  const handleManualPlay = useCallback(async () => {
    const video = videoRef.current;
    const audio = audioRef.current;

    try {
      if (video) {
        video.muted = true;
        await video.play();
      }
      if (audio) {
        await audio.play();
      }
      setIsPlaying(true);
      setShowCaption(true);
    } catch {
      // Fallback: unmute video
      if (video) {
        video.muted = false;
        try {
          await video.play();
          setIsPlaying(true);
        } catch {
          /* give up */
        }
      }
    }
  }, []);

  // Replay
  const handleReplay = useCallback(() => {
    const video = videoRef.current;
    const audio = audioRef.current;

    playbackCompleteRef.current = false;
    setHasPlayed(false);
    // Reset progress bar directly
    if (progressRef.current) progressRef.current.style.width = '0%';

    if (video) {
      video.currentTime = 0;
    }
    if (audio) {
      audio.currentTime = 0;
    }
  }, []);

  if (videoError) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-red-500/20 bg-black/60">
        <div className="flex flex-col items-center gap-2 text-center">
          <svg
            className="h-8 w-8 text-red-400/60"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M23 7l-7 5 7 5V7zM14 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z" />
            <line x1="4" y1="4" x2="20" y2="20" strokeWidth="2" />
          </svg>
          <span className="text-text-muted text-sm">Video failed to load</span>
        </div>
      </div>
    );
  }

  return (
    <div className="video-chat-player group relative w-full overflow-hidden rounded-2xl bg-black shadow-2xl shadow-black/40">
      {/* Loading state */}
      {isLoading && <VideoChatLoader variant="generating" />}

      {/* Video element */}
      {!isLoading && (
        <>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption -- voiceover provided via TTS audio */}
          <video
            ref={videoRef}
            src={videoUrl}
            playsInline
            preload="metadata"
            className="aspect-video w-full object-cover"
            onLoadedMetadata={() => setVideoReady(true)}
            onEnded={handleVideoEnd}
            onError={() => setVideoError(true)}
          />

          {/* TTS audio element (invisible) */}
          {audioUrl && (
            // eslint-disable-next-line jsx-a11y/media-has-caption -- TTS audio, no caption needed
            <audio
              ref={audioRef}
              src={audioUrl}
              preload="auto"
              onCanPlayThrough={() => setAudioReady(true)}
              onEnded={handleAudioEnd}
            />
          )}

          {/* Play button overlay (shown when auto-play is blocked) */}
          {videoReady && !isPlaying && !hasPlayed && (
            <button
              onClick={handleManualPlay}
              className="absolute inset-0 flex items-center justify-center bg-black/40 transition-all hover:bg-black/30"
              aria-label="Play video"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#00ff41]/90 shadow-lg shadow-[#00ff41]/30 transition-transform hover:scale-110 sm:h-20 sm:w-20">
                <svg
                  className="ml-1 h-7 w-7 text-black sm:h-8 sm:w-8"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </div>
            </button>
          )}

          {/* Replay button (shown after playback completes) */}
          {hasPlayed && (
            <button
              onClick={handleReplay}
              className="absolute inset-0 flex items-center justify-center bg-black/50 transition-all hover:bg-black/40"
              aria-label="Replay video"
            >
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/20 bg-white/10 backdrop-blur-sm transition-transform hover:scale-110 sm:h-16 sm:w-16">
                  <svg
                    className="h-6 w-6 text-white/80 sm:h-7 sm:w-7"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="1 4 1 10 7 10" />
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                  </svg>
                </div>
                <span className="text-xs font-medium text-white/60">Replay</span>
              </div>
            </button>
          )}

          {/* Caption overlay */}
          {showCaption && spokenText && (
            <div className="video-chat-caption pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pt-12 pb-4 sm:px-6 sm:pb-5">
              <p className="text-center text-sm leading-relaxed text-white/90 drop-shadow-lg sm:text-base">
                {spokenText}
              </p>
            </div>
          )}

          {/* Progress bar — direct DOM updates, no React re-renders */}
          {(isPlaying || hasPlayed) && (
            <div className="absolute inset-x-0 bottom-0 h-1">
              <div
                ref={progressRef}
                className={`h-full ${hasPlayed ? 'bg-[#00ff41]/40' : 'bg-[#00ff41]'}`}
                style={{ width: hasPlayed ? '100%' : '0%', willChange: 'width' }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
});
